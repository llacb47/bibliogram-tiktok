const constants = require("../constants")

/**
 * Check that a host is part of Instagram's CDN.
 * @param {string} host
 */
function verifyHost(host) {
	//const domains = ["fbcdn.net", "cdninstagram.com", "tiktok"]
	return true;

	//return domains.some(against => host === against || host.endsWith("." + against))
}

/**
 * Check that a resource is on Instagram.
 * @param {URL} completeURL
 */
function verifyURL(completeURL) {
	const params = completeURL.searchParams
	if (!params.get("url")) return { status: "fail", value: [400, "Must supply `url` query parameter"] }
	try {
		var url = new URL(params.get("url"))
	} catch (e) {
		return { status: "fail", value: [400, "`url` query parameter is not a valid URL"] }
	}
	// check url protocol
	if (url.protocol !== "https:") return { status: "fail", value: [400, "URL protocol must be `https:`"] }
	// check url host
	if (!verifyHost(url.host)) return { status: "fail", value: [400, "URL host is not allowed"] }
	return { status: "ok", url }
}

/**
 * Rewrite URL to the image proxy.
 * @param toskey 
 */
// TODO: change param names to reflect that we are passing the toskey not the url
function rewriteURLImageProxy(toskeyURL) {
	const x = new URL(toskeyURL).searchParams
	const key = unescape(x.get('url'))
	if (x.get('userID')) {
		var url = `${constants.tiktok.secretpath1}${key}.webp`
	} else if (x.get('width')) {
		var url = `${constants.tiktok.secretpath2}${key}/`
	}
	return { status: "ok", url }
}

function proxyImage(url, width) {
	const params = new URLSearchParams()
	if (width) params.set("width", width)
	params.set("url", url)
	return "/imageproxy?" + params.toString()
}

function proxyProfilePic(url, userID) {
	const params = new URLSearchParams()
	params.set("userID", userID)
	params.set("url", url)
	return "/imageproxy?" + params.toString()
}

function proxyVideo(url) {
	const params = new URLSearchParams()
	params.set("url", url)
	return "/videoproxy?" + params.toString()
}

/**
 * @param {import("../types").ExtendedOwner} owner
 */
function proxyExtendedOwner(owner) {
	const clone = { ...owner }
	clone.profile_pic_url = proxyProfilePic(clone.avatar_thumb.uri, clone.uid)
	return clone
}

module.exports.proxyImage = proxyImage
module.exports.proxyProfilePic = proxyProfilePic
module.exports.proxyVideo = proxyVideo
module.exports.proxyExtendedOwner = proxyExtendedOwner
module.exports.verifyHost = verifyHost
module.exports.verifyURL = verifyURL
module.exports.rewriteURLImageProxy = rewriteURLImageProxy
