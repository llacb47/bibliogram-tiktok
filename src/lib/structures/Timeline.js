const { Feed } = require("feed")
const constants = require("../constants")
const db = require("../db")
const TimelineEntry = require("./TimelineEntry")
const InstaCache = require("../cache")
const collectors = require("../collectors")
const { getFeedSetup } = require("../utils/feed")
require("../testimports")(constants, collectors, TimelineEntry, InstaCache)

/** @param {any[]} edges */
function transformEdges(edges) {
	//console.log(typeof edges)
	//console.log(edges)
	return edges.map(e => {
		/** @type {import("../types").TimelineEntryAll} */
		//const data = e.node
		const data = e
		// @ts-ignore
		const entry = collectors.getOrCreateShortcode(data.aweme_id)
		entry.apply(data)
		// HACK for __typename
		entry.data.__typename = "GraphVideo"
		//console.log('ENTRY IS')
		//console.log(entry)
		return entry
	})
}

class Timeline {
	/**
	 * @param {import("./User")|import("./ReelUser")} user
	 * @param {string} type
	 */
	constructor(user, type) {
		this.user = user
		/** one of: "timeline", "igtv" */
		this.type = type
		/** @type {import("./TimelineEntry")[][]} */
		this.pages = []
		this.entryCount = 0
		//try {
		if (this.type === "timeline") {
			//if (this.user.data.edge_owner_to_timeline_media) {
			//	this.addPage(this.user.data.edge_owner_to_timeline_media)
			//}
			// @ts-ignore
			this.addPage(this.user.aweme_list)
		} else if (this.type === "igtv") {
			if (this.user.data.edge_felix_video_timeline) {
				this.addPage(this.user.data.edge_felix_video_timeline)
			}
		}
		//} catch (e) { }
	}

	hasNextPage() {
		// @ts-ignore
		return !this.page_info || this.page_info.has_next_page
	}

	fetchNextPage() {
		if (!this.hasNextPage()) return constants.symbols.NO_MORE_PAGES
		const method =
			this.type === "timeline" ? collectors.fetchTimelinePage
				: this.type === "igtv" ? collectors.fetchIGTVPage
					: null
		// @ts-ignore
		//const after = this.page_info ? this.page_info.end_cursor : ""
		const after = this.user.cursor
		// @ts-ignore
		return method(this.user.data.user.uid, after).then(({ result: coolArray, fromCache }) => {
			this.user.newCursor = coolArray[1];
			const quotaUsed = fromCache ? 0 : 1
			this.addPage(coolArray[0])
			return { page: this.pages.slice(-1)[0], quotaUsed }
		})
	}

	async fetchUpToPage(index) {
		let quotaUsed = 0
		while (this.pages[index] === undefined && this.hasNextPage()) {
			const result = await this.fetchNextPage()
			if (typeof result !== "symbol") {
				quotaUsed += result.quotaUsed
			}
		}
		return quotaUsed
	}

	addPage(page) {
		// update whether the user should be private
		// TODO: fix timeline fetching for a private user
		// Ideally, we will not req aweme/post if a user is private
		//console.log(page)
		if (page !== null) {
			if (this.pages.length === 0 && page.count > 0) { // this is the first page, and user has posted
				//const shouldBePrivate = page.edges.length === 0
				//if (shouldBePrivate !== this.user.data.is_private) {
				//	db.prepare("UPDATE Users SET is_private = ? WHERE user_id = ?").run(+shouldBePrivate, this.user.data.id)
				//	this.user.data.is_private = shouldBePrivate
				//}
			}
			//if ()
			// add the page
			// instagram: page.edges holds the media objects
			this.pages.push(transformEdges(page))
			// IG: used for cursoring
			//this.page_info = page.page_info
			// update self post count
			this.entryCount = page.length
			// update user post count
			if (this.type === "timeline") {
				this.user.posts = page.length
			}
		}
	}

	async fetchFeed() {
		const setup = getFeedSetup(this.user.data.username, this.user.data.biography, constants.website_origin + this.user.proxyProfilePicture, new Date(this.user.cachedAt))
		const feed = new Feed(setup)
		const page = this.pages[0] // only get posts from first page
		await Promise.all(page.map(item =>
			item.fetchFeedData().then(feedData => feed.addItem(feedData))
		))
		return feed
	}
}

module.exports = Timeline
