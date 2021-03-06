const constants = require("../constants")
const { proxyThumbOrVid, proxyExtendedOwner } = require("../utils/proxyurl")
const { compile } = require("pug")
const collectors = require("../collectors")
const { structure, removeTrailingHashtags } = require("../utils/structuretext")
const TimelineBaseMethods = require("./TimelineBaseMethods")
const TimelineChild = require("./TimelineChild")
require("../testimports")(collectors, TimelineChild, TimelineBaseMethods)

const rssDescriptionTemplate = compile(`
if caption
	each line in caption.split("\\n")
		= line
		br
each child in children
	!= child.getFeedItem()
`)

class TimelineEntry extends TimelineBaseMethods {
	constructor() {
		super()
		/** @type {import("../types").TimelineEntryAll} some properties may not be available yet! */
		// @ts-ignore
		this.data = {}
		this.data.__typename = "GraphVideo"

		/** @type {string} Not available until fetchExtendedOwnerP is called */
		this.ownerPfpCacheP = null
		/** @type {import("./TimelineChild")[]} Not available until fetchChildren is called */
		this.children = null
		this.date = null
	}

	async update() {
		return collectors.fetchShortcodeData(this.data.shortcode).then(data => {
			this.applyN3(data.result)
		}).catch(error => {
			console.error("TimelineEntry could not self-update; trying to continue anyway...")
			console.error("E:", error)
		})
	}

	/**
	 * General apply function that detects the data format
	 */
	apply(data) {
		if (!data.display_resources) {
			this.applyN1(data)
		} else if (data.thumbnail_resources) {
			this.applyN2(data)
		} else {
			this.applyN3(data)
		}
	}

	/**
	 * @param {import("../types").TimelineEntryN1} data
	 */
	applyN1(data) {
		Object.assign(this.data, data)
		this.fixData()
	}

	/**
	 * @param {import("../types").TimelineEntryN2} data
	 */
	applyN2(data) {
		Object.assign(this.data, data)
		this.fixData()
	}

	/**
	 * @param {import("../types").TimelineEntryN3} data
	 */
	applyN3(data) {
		Object.assign(this.data, data)
		this.fixData()
	}

	/**
	 * This should keep the same state when applied multiple times to the same data.
	 * All mutations should act exactly once and have no effect on already mutated data.
	 */
	fixData() {
		this.date = new Date(this.data.create_time * 1000)
	}

	getDisplayDate() {
		function pad(number) {
			return String(number).padStart(2, "0")
		}
		return (
			`${this.date.getUTCFullYear()}`
			+ `-${pad(this.date.getUTCMonth() + 1)}`
			+ `-${pad(this.date.getUTCDate())}`
			+ ` ${pad(this.date.getUTCHours())}`
			+ `:${pad(this.date.getUTCMinutes())}`
			+ ` UTC`
		)
	}

	getCaption() {
		//const edge = this.data.edge_media_to_caption.edges[0]
		//if (!edge) return null // no caption
		//else return edge.node.text.replace(/\u2063/g, "") // I don't know why U+2063 INVISIBLE SEPARATOR is in here, but it is, and it causes rendering issues with certain fonts, so let's just remove it.
		return this.data.desc
		//console.log(this)
	}

	getStructuredCaption() {
		const caption = this.getCaption()
		if (!caption) return null // no caption
		else return structure(caption)
	}

	getStructuredCaptionWithoutTrailingHashtags() {
		const structured = this.getStructuredCaption()
		if (!structured) return null // no caption
		else return removeTrailingHashtags(structured)
	}

	/**
	 * Try to get the first meaningful line or sentence from the caption.
	 */
	getCaptionIntroduction() {
		const caption = this.getCaption()
		if (!caption) return null
		else return caption.split("\n")[0].split(". ")[0]
	}

	/**
	 * Alt text is not available for N2, the caption or a placeholder string will be returned instead.
	 * @override
	 */
	getAlt() {
		return this.data.accessibility_caption || this.getCaption() || "No image description available."
	}

	/**
	 * @returns {import("../types").BasicOwner}
	 */
	getBasicOwner() {
		return this.data.author
	}

	/**
	 * Not available on N3!
	 * Returns proxied URLs (P)
	 */
	getThumbnailSrcsetP() {
		if (this.data.thumbnail_resources) {
			return this.data.thumbnail_resources.map(tr => {
				let src = tr.src
				if (constants.proxy_media.thumbnail) src = proxyImage(tr.src, tr.config_width)
				return `${src} ${tr.config_width}w`
			}).join(", ")
		} else {
			return null
		}
	}

	/**
	 * Not available on N3!
	 * Returns proxied URLs (P)
	 * @param {number} size
	 * @return {import("../types").DisplayResource}
	 */
	getSuggestedThumbnailP(opts = {}) {
		// this.data.video.cover.url_list[0]
		/*
		if (this.data.thumbnail_resources) {
			let found = null // start with nothing
			for (const tr of this.data.thumbnail_resources) { // and keep looping up the sizes (sizes come sorted)
				found = tr
				if (tr.config_width >= size) break // don't proceed once we find one large enough
			}
			let src = found.src
			if (constants.proxy_media.thumbnail) src = proxyImage(src, found.config_width) // force resize to config rather than requested
			return {
				config_width: found.config_width,
				config_height: found.config_height,
				src
			}
		} else if (this.data.thumbnail_src) {
			let src = this.data.thumbnail_src
			if (constants.proxy_media.thumbnail) src = proxyImage(src, size) // force resize to requested
			return {
				config_width: size, // probably?
				config_height: size,
				src
			}
		} else {
			return null
		}
		*/
		//let src = this.data.video.cover.url_list[0]
		// musicallys dont have animated_cover
		// TODO: add setting for user wants animated cover
		let key = (typeof this.data.video.animated_cover !== "undefined" && opts.animated) ? this.data.video.animated_cover.uri : this.data.video.cover.uri
		//let key = 'bigchungus'
		if (constants.proxy_media.thumbnail) {
			var src = proxyThumbOrVid(key, this.data.video.cover.width, this.data.aweme_id)
		}// force resize to config rather than requested
		return {
			config_width: this.data.video.cover.width,
			config_height: this.data.video.cover.width,
			src
		}
	}

	getThumbnailSizes() {
		if (this.data.thumbnail_resources) {
			return `(max-width: 820px) 200px, 260px` // from css :(
		} else {
			return null
		}
	}

	async fetchChildren() {
		let fromCache = true
		await (async () => {
			// Cached children?
			if (this.children) return

			this.children = [new TimelineChild(this.data)]
			return

		})()
		return { fromCache, children: this.children }
	}

	/**
	 * Returns a proxied profile pic URL (P)
	 * @returns {Promise<{owner: import("../types").ExtendedOwner, fromCache: boolean}>}
	 */
	async fetchExtendedOwnerP() {
		let fromCache = true
		const clone = await (async () => {
			// Do we just already have the extended owner?
			//console.log(this.data)
			if (this.data.author) { // this property is on extended owner and not basic owner
				const clone = proxyExtendedOwner(this.data.author)
				this.ownerPfpCacheP = clone.profile_pic_url
				return clone
			}
			// The owner may be in the user cache, so copy from that.


			else if (false) {
				/** @type {import("./User")} */
				const user = collectors.userRequestCache.getByID(this.data.owner.id)
				if (user.data.full_name !== undefined) {
					this.data.owner = {
						id: user.data.id,
						username: user.data.username,
						is_verified: user.data.is_verified,
						full_name: user.data.full_name,
						profile_pic_url: user.data.profile_pic_url // _hd is also available here.
					}
					const clone = proxyExtendedOwner(this.data.owner)
					this.ownerPfpCacheP = clone.profile_pic_url
					return clone
				}
				// That didn't work, so just fall through...
			}
			/**
			// We'll have to re-request ourselves.
			fromCache = false
			await this.update()
			const clone = proxyExtendedOwner(this.data.owner)
			this.ownerPfpCacheP = clone.profile_pic_url
			return clone
			**/
		})()
		return { owner: clone, fromCache }
	}

	fetchVideoURL() {
		//if (!this.isVideo()) {
		//	return Promise.resolve({ fromCache: true, videoURL: null })
		//} else if (this.data.video_url) {
		return Promise.resolve({ fromCache: true, videoURL: this.getVideoUrlP() })
		//}// else {
		//	return this.update().then(() => {
		//		return { fromCache: false, videoURL: this.getVideoUrlP() }
		//	})
		//}
	}

	/**
	 * @returns {Promise<import("feed/src/typings/index").Item>}
	 */
	async fetchFeedData() {
		const { children } = await this.fetchChildren()
		return {
			title: this.getCaptionIntroduction() || `New post from @${this.getBasicOwner().username}`,
			description: rssDescriptionTemplate({
				caption: this.getCaption(),
				children
			}),
			link: `${constants.website_origin}/p/${this.data.shortcode}`,
			id: `bibliogram:post/${this.data.shortcode}`, // Is it wise to keep the origin in here? The same post would have a different ID from different servers.
			published: new Date(this.data.taken_at_timestamp * 1000), // first published date
			date: new Date(this.data.taken_at_timestamp * 1000) // last modified date
			/*
				Readers should display the description as HTML rather than using the media enclosure.
				enclosure: {
					url: this.data.display_url,
					type: "image/jpeg" // Instagram only has JPEGs as far as I can tell
				}
			*/
		}
	}
}

module.exports = TimelineEntry
