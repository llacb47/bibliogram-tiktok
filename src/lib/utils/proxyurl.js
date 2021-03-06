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
	var url = params.get("url")
	try {
		//var url = new URL(params.get("url"))
	} catch (e) {
		//return { status: "fail", value: [400, "`url` query parameter is not a valid URL"] }
	}
	// check url protocol
	//if (url.protocol !== "https:") return { status: "fail", value: [400, "URL protocol must be `https:`"] }
	// check url host
	//if (!verifyHost(url.host)) return { status: "fail", value: [400, "URL host is not allowed"] }
	return { status: "ok", url }
}

/**
 * Rewrite URL to the secret proxy.
 * @param toskeyURL 
 */
// TODO: change param names to reflect that we are passing the toskey not the url
function rewriteURLSecretProxy(toskeyURL) {
	/** 
	let isOldBucket = false;
	const x = new URL(toskeyURL).searchParams
	let key = unescape(x.get('url'))
	let domain = choose(constants.tiktok.secretpaths) + 'obj/'
	if (!key.includes('-tx')) {
		domain = constants.tiktok.secretpath2
		isOldBucket = !isOldBucket
	}
	//console.log(domain)
	//console.log(key)
	if (key.charAt(0) == '/') key = key.substr(1);
	if (key.charAt(key.length - 1) == '/') key = key.substr(0, key.length - 1);
	if (x.get('userID')) { // it's a profile picture
		var url = `${constants.tiktok.secretpath3}${key}~c5.webp`
	} else if (x.get('width')) { // it's a video thumb
		//var url = `${domain}${key}.awebp` // awebp extension is not needed
		/* for animated thumbs
		var url = `${domain}${key}`
		isOldBucket && (url += '/')
		/*
		var url = `${constants.tiktok.secretpath4}${x.get('aweme_id')}&${Math.random().toString(36).replace(/[^a-z]+/g, '').substr(0, 5)}`
	} else if (x.get('video_id')) {
		var url = `${constants.tiktok.secretpath5}${x.get('video_id')}`
	} else { // it's a video
		//var url = `${constants.tiktok.secretpath2}${key}/`
		var url = `${domain}${key}`
		isOldBucket && (url += '/')
	}
	**/

	const x = new URL(toskeyURL).searchParams
	let key = x.get('url') || ''
	if (key.charAt(0) == '/') key = key.substr(1);
	if (key.charAt(key.length - 1) == '/') key = key.substr(0, key.length - 1);
	//console.log(key)
	let prefix = choose(constants.tiktok.secretpaths2) + 'origin/'
	let fallbackToOldBucketBecauseOldBucket = false;
	let isVeryRestrictedBucket = (key.includes('-tx') && key.includes('-pve-'))
	if (!x.get('userID') && !x.get('video_id')) {
		//if (key.includes('-tx') && !key.includes('-pve-')) {
		//return; // tiktok can you make your cdns any less crappy thanks
		//}
		if (!key.includes('-tx')) {
			prefix = constants.tiktok.secretpath2
			fallbackToOldBucketBecauseOldBucket = !fallbackToOldBucketBecauseOldBucket
		}
		else if (isVeryRestrictedBucket) {
			prefix = choose(constants.tiktok.secretpaths) + 'origin/'
		}
	}

	if (x.get('userID')) { // pfp
		var url = `${prefix}${key}.awebp`
	} else if (x.get('video_id')) {
		//	if (x.get('type') == 'b64enc') {
		var url = Buffer.from(x.get('video_id'), 'base64').toString('ascii')
		//} else {

		//}
	} else {
		var url = `${prefix}${key}`
		if (fallbackToOldBucketBecauseOldBucket) {
			url += '/'
		} else if (x.get('width')) {
			url += '.awebp'
		}
		//fallbackToOldBucketBecauseOldBucket && ()
	}

	return { status: "ok", url }
}

function choose(choices) {
	var index = Math.floor(Math.random() * choices.length);
	return choices[index];
}

function proxyThumbOrVid(url, width, aweme_id, video_id, type) {
	const params = new URLSearchParams()
	if (width) params.set("width", width) // this is a video thumb
	if (aweme_id) params.set("aweme_id", aweme_id)
	if (video_id) params.set("video_id", video_id)
	if (type) params.set("type", type)
	!video_id && params.set("url", url)
	return "/generalproxy?" + params.toString()
}

function proxyProfilePic(url, userID) {
	const params = new URLSearchParams()
	params.set("userID", userID)
	params.set("url", url)
	return "/generalproxy?" + params.toString()
}

/**
 * @param {import("../types").ExtendedOwner} owner
 */
function proxyExtendedOwner(owner) {
	const clone = { ...owner }
	// @ts-ignore
	clone.profile_pic_url = proxyProfilePic(clone.avatar_thumb.uri, clone.uid)
	return clone
}

module.exports.proxyThumbOrVid = proxyThumbOrVid
module.exports.proxyProfilePic = proxyProfilePic
//module.exports.proxyVideo = proxyVideo
module.exports.proxyExtendedOwner = proxyExtendedOwner
module.exports.verifyHost = verifyHost
module.exports.verifyURL = verifyURL
module.exports.rewriteURLSecretProxy = rewriteURLSecretProxy
