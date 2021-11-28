const gm = require("gm")
const constants = require("../../lib/constants")
const collectors = require("../../lib/collectors")
const { request } = require("../../lib/utils/request")
const { verifyURL, rewriteURLSecretProxy } = require("../../lib/utils/proxyurl")
const db = require("../../lib/db")
require("../../lib/testimports")(constants, request, db, verifyURL)
const { backOff } = require("exponential-backoff");


function statusCodeIsAcceptable(status) {
	return (status >= 200 && status < 300) || status === 304
}

function requestWasRateLimited(status) {
	return (status === 429)
}

/**
 * @param {string} url
 */
async function proxyResource(url, suggestedHeaders = {}, refreshCallback = null) {
	// console.log(`Asked to proxy ${url}\n`, suggestedHeaders)
	const headersToSend = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; rv:91.0) Gecko/20100101 Firefox/96.0' }
	//console.log(suggestedHeaders)
	if ("range" in suggestedHeaders && !url.includes('-maliva.')) {
		//console.log(suggestedHeaders["range"])
		//if (suggestedHeaders["range"] !== "bytes=0-") {
		headersToSend["range"] = suggestedHeaders["range"];
		//}
	}
	for (const key of ["accept", "accept-encoding", "accept-language"]) {
		if (suggestedHeaders[key]) headersToSend[key] = suggestedHeaders[key]
	}
	let sent, stream, response;
	sent = request(url, { headers: headersToSend, followRedirect: true }, { log: false })
	response = await sent.response()
	if (requestWasRateLimited(response.status)) {
		// console.log("UGH ... A 429")
		throw new Error("Request failed... 429 status code")
	}
	stream = await sent.stream()
	//let outerurl = url;
	// console.log(response.status, response.headers)
	if (statusCodeIsAcceptable(response.status)) {
		const headersToReturn = {}
		for (const key of ["content-type", "date", "last-modified", "expires", "cache-control", "accept-ranges", "content-range", "origin", "etag", "content-length", "transfer-encoding"]) {
			headersToReturn[key] = response.headers.get(key)
		}
		//let headerIterator = response.headers.entries()
		//for (let i = 0; i < response.headers.size; i++) {
		//	console.log("header " + i + " is " + headerIterator.next().value);
		//}
		headersToReturn["x-upstream-cache-status"] = response.headers.get("x-bdcdn-cache-status")
		headersToReturn["x-upstream-cdn-cache"] = response.headers.get("x-cache")
		headersToReturn["x-upstream-fastly-served-by"] = response.headers.get("x-served-by")
		headersToReturn["x-upstream-timing"] = response.headers.get("server-timing")

		// shitty fix for webp plain text
		if (headersToReturn["content-type"] == "text/plain; charset=utf-8") {
			headersToReturn["content-type"] = "image/webp"
		}

		headersToReturn["cache-control"] = constants.caching.image_cache_control
		headersToReturn["accept-ranges"] = "bytes";
		// TODO: implement chunking/partial content serving 
		// without this: chrome users cant seek thru the video

		return {
			statusCode: response.status,
			headers: headersToReturn,
			stream: stream
		}
	}
	//else if (refreshCallback && [410, 404, 403].includes(response.status)) { // profile picture has since changed
	//	return refreshCallback()
	//} //else if (1 && response.status == 429) {
	// retry?
	//	console.log("got 429")
	//	if (outerurl.includes("p16")) {
	//		outerurl = outerurl.replace("p16", "p19")
	//	} else if (outerurl.includes("p19")) {
	//		outerurl = outerurl.replace("p19", "p16")

	//	}
	//	return proxyResource(outerurl)
	else if ([503, 429].includes(response.status)) {
		//return {
		//	statusCode: 502,
		//	headers: {
		//		"Content-Type": "text/plain; charset=UTF-8"
		//	},
		//	content: `Instagram returned HTTP status ${response.status}, which is not a success code.`
		//}
		//console.log(`Request failed with status code ${response.status}`)
		//throw "Request failed."
	}
}

module.exports = [
	/*{
		route: "/imageproxy", methods: ["GET"], code: async (input) => {
			//const verifyResult = verifyURL(input.url)
			const rewriteResult = rewriteURLSecretProxy(input.url)
			//if (verifyResult.status !== "ok") return verifyResult.value
			//if (!["png", "jpg"].some(ext => verifyResult.url.pathname.endsWith(ext))) return [400, "URL extension is not allowed"]
			const params = input.url.searchParams
			const width = +params.get("width")
			if (typeof width === "number" && !isNaN(width) && width > 0) {
				/*
				  This uses graphicsmagick to force crop the image to a
				  square. Some thumbnails aren't square and would be
				  stretched on the page without this. If I cropped the
				  images client side, it would have to be done with CSS
				  background-image, which means no <img srcset>.
				*/

	/*
	return request(rewriteResult.url, {}, { log: false }).stream().then(body => {
		//const image = gm(body).gravity("Center").crop(width, width, 0, 0).repage("+")
		const image = gm(body)
		const stream = image.stream("jpg")
		return {
			statusCode: 200,
			//contentType: "image/jpeg",
			// thumbs are webp or awebp
			contentType: "image/webp",
			headers: {
				"Cache-Control": constants.caching.image_cache_control
			},
			stream
		}
		
	})//////
	return proxyResource(rewriteResult.url.toString(), input.req.headers)
} else {
	// No specific size was requested, so just stream proxy the file directly.
	//if (params.has("userID")) {
	if (false) {
		/*
		  Users get special handling, because we need to update
		  their profile picture if an expired version is cached
		//
		return proxyResource(rewriteResult.url.toString(), input.req.headers, () => {
			// If we get here, we got HTTP 410 GONE.
			const userID = params.get("userID")
			// TODO: fix this - proper caching using db
			const storedProfilePicURL = db.prepare("SELECT profile_pic_url FROM Users WHERE user_id = ?").pluck().get(userID)
			if (storedProfilePicURL === rewriteResult.url.toString()) {
				// Everything looks fine, find out what the new URL for the provided user ID is and store it.
				return collectors.updateProfilePictureFromReel(userID).then(url => {
					// Updated. Return the new picture (without recursing)
					return proxyResource(url, input.req.headers)
				}).catch(error => {
					console.error(error)
					return {
						statusCode: 500,
						headers: {
							"Content-Type": "text/plain; charset=UTF-8"
						},
						content: String(error)
					}
				})
			} else {
				// The request is a lie!
				return {
					statusCode: 400,
					headers: {
						"Content-Type": "text/plain; charset=UTF-8"
					},
					content: "Profile picture must be refreshed, but provided userID parameter does not match the stored profile_pic_url."
				}
			}
		})
	} else {
		return proxyResource(rewriteResult.url.toString(), input.req.headers)
	}
}
}
},
{
route: "/videoproxy", methods: ["GET"], code: async (input) => {
const verifyResult = verifyURL(input.url)
const rewriteResult = rewriteURLSecretProxy(input.url)
if (verifyResult.status !== "ok") return verifyResult.value
const url = verifyResult.url
//if (!["mp4"].some(ext => url.pathname.endsWith(ext))) return [400, "URL extension is not allowed"]
return proxyResource(url.toString(), input.req.headers)
}
},*/
	{
		route: '/generalproxy', methods: ['GET'], code: async (input) => {
			//console.log(input.req.headers)
			//if ("Range" in input.req.headers) {
			//
			//}
			const rewriteResult = rewriteURLSecretProxy(input.url)
			// console.log(rewriteResult.url + "rw result")
			return await backOff(() => proxyResource(rewriteResult.url.toString(), input.req.headers), { jitter: 'full' })
			//try {
			//	return proxyResource(rewriteResult.url.toString(), input.req.headers)
			//} catch (e) {
			//	console.log(e)
			//}
		}
	}
]
