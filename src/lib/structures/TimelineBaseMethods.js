const constants = require("../constants")
const { proxyThumbOrVid } = require("../utils/proxyurl")

class TimelineBaseMethods {
	constructor() {
		/** @type {import("../types").GraphChildAll & {owner?: any}} */
		this.data
	}

	getType() {
		// there are no images on tiktok

		if (this.data.owner) return constants.symbols.TYPE_VIDEO
		else return constants.symbols.TYPE_GALLERY_VIDEO

	}

	isVideo() {
		return this.data.__typename === "GraphVideo"
	}

	getDisplayUrlP() {
		// TODO: remove this method
		throw new Error("This should never be called because there are no images")
		let url = this.data.display_url
		if (constants.proxy_media.image) url = proxyThumbOrVid(url)
		return url
	}

	getVideoUrlP() {
		//let url = this.data.video_url
		// https://v19.tiktokcdn.com/21ad57a17d78033d07a3154bc829b159/61555594/video/tos/alisg/tos-alisg-pv-0037c001/res/2015/02/03/17/f6825639-5fbf-44fc-8b46-53ce78173f20.mp4/
		let url = this.data.video.play_addr.url_list[0]
		let key = url.split('?')[0].substr(url.indexOf('/tos-'))
		if (constants.proxy_media.video) url = proxyThumbOrVid(key)
		// todo: protect/encrypt video id somehow
		return proxyThumbOrVid(unescape(key), null, null, this.data.video.play_addr.uri)
	}

	getAlt() {
		//return this.data.accessibility_caption || "No image description available."
		return "No description"
	}
}

module.exports = TimelineBaseMethods
