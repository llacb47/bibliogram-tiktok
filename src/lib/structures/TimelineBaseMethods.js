const constants = require("../constants")
const { proxyImage, proxyVideo } = require("../utils/proxyurl")

class TimelineBaseMethods {
	constructor() {
		/** @type {import("../types").GraphChildAll & {owner?: any}} */
		this.data
	}

	getType() {
		if (this.data.__typename === "GraphImage") {
			if (this.data.owner) return constants.symbols.TYPE_IMAGE
			else return constants.symbols.TYPE_GALLERY_IMAGE
		} else if (this.data.__typename === "GraphVideo") {
			if (this.data.owner) return constants.symbols.TYPE_VIDEO
			else return constants.symbols.TYPE_GALLERY_VIDEO
		} else if (this.data.__typename === "GraphSidecar") {
			return constants.symbols.TYPE_GALLERY
		} else {
			throw new Error("Unknown shortcode __typename: " + this.data.__typename)
		}
	}

	isVideo() {
		return this.data.__typename === "GraphVideo"
	}

	getDisplayUrlP() {
		// TODO: remove this method
		throw new Error("This should never be called because there are no images")
		let url = this.data.display_url
		if (constants.proxy_media.image) url = proxyImage(url)
		return url
	}

	getVideoUrlP() {
		//let url = this.data.video_url
		// https://v19.tiktokcdn.com/21ad57a17d78033d07a3154bc829b159/61555594/video/tos/alisg/tos-alisg-pv-0037c001/res/2015/02/03/17/f6825639-5fbf-44fc-8b46-53ce78173f20.mp4/
		let url = this.data.video.play_addr.url_list[0]
		let key = url.split('?')[0].substr(url.indexOf('/tos-'))
		if (constants.proxy_media.video) url = proxyVideo(key)
		return key
	}

	getAlt() {
		return this.data.accessibility_caption || "No image description available."
	}
}

module.exports = TimelineBaseMethods
