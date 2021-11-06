const constants = require("./constants")
const { request } = require("./utils/request")
const switcher = require("./utils/torswitcher")
const { extractSharedData } = require("./utils/body")
const { TtlCache, RequestCache, UserRequestCache } = require("./cache")
const RequestHistory = require("./structures/RequestHistory")
const db = require("./db")
require("./testimports")(constants, request, extractSharedData, UserRequestCache, RequestHistory, db)

const requestCache = new RequestCache(constants.caching.resource_cache_time)
/** @type {import("./cache").UserRequestCache<import("./structures/User")|import("./structures/ReelUser")>} */
const userRequestCache = new UserRequestCache(constants.caching.resource_cache_time)
/** @type {import("./cache").TtlCache<import("./structures/TimelineEntry")>} */
const timelineEntryCache = new TtlCache(constants.caching.resource_cache_time)
const history = new RequestHistory(["user", "timeline", "igtv", "post", "reel"])

const AssistantSwitcher = require("./structures/AssistantSwitcher")


const user = require("../site/assistant_api/user")


const { promise } = require("selenium-webdriver")
//const User = require("./structures/User")
//const TiktokUser = require("./structures/TiktokUser")

const assistantSwitcher = new AssistantSwitcher()


const { backOff } = require("exponential-backoff");

// tiktok
//const crypto = require('crypto');

/**
 * @param {string} username
 * @param {symbol} [context]
 */
async function fetchUser(username, context) {
	//console.log(constants.allow_user_from_reel)
	if (constants.external.reserved_paths.includes(username)) {
		throw constants.symbols.ENDPOINT_OVERRIDDEN
	}

	let mode = constants.allow_user_from_reel
	if (mode === "preferForRSS") {
		if (context === constants.symbols.fetch_context.RSS) mode = "prefer"
		else mode = "onlyPreferSaved"
	}
	if (context === constants.symbols.fetch_context.ASSISTANT) {
		const saved = db.prepare("SELECT username, user_id, updated_version, biography, post_count, following_count, followed_by_count, external_url, full_name, is_private, is_verified, profile_pic_url FROM Users WHERE username = ?").get(username)
		if (saved && saved.updated_version >= 2) {
			return fetchUserFromSaved(saved)
		} else {
			return fetchUserFromHTML(username)
		}
	}
	if (mode === "never") {
		return fetchUserFromHTML(username)
	}
	if (mode === "prefer") {
		const saved = db.prepare("SELECT username, user_id, updated_version, biography, post_count, following_count, followed_by_count, external_url, full_name, is_private, is_verified, profile_pic_url FROM Users WHERE username = ?").get(username)
		if (saved && saved.updated_version >= 2) {
			return fetchUserFromSaved(saved)
		} else if (saved && saved.updated_version === 1) {
			return fetchUserFromCombined(saved.user_id, saved.username)
		} else {
			return fetchUserFromHTML(username)
		}
	}
	if (mode === "onlyPreferSaved") {
		const saved = db.prepare("SELECT username, user_id, updated_version, biography, post_count, following_count, followed_by_count, external_url, full_name, is_private, is_verified, profile_pic_url FROM Users WHERE username = ?").get(username)
		if (saved && saved.updated_version >= 2) {
			return fetchUserFromSaved(saved)
		} else {
			mode = "fallback"
		}
	}
	if (mode === "fallback") {
		return fetchUserFromHTML(username).catch(error => {
			if (error === constants.symbols.INSTAGRAM_DEMANDS_LOGIN || error === constants.symbols.RATE_LIMITED) {
				const saved = db.prepare("SELECT username, user_id, updated_version, biography, post_count, following_count, followed_by_count, external_url, full_name, is_private, is_verified, profile_pic_url FROM Users WHERE username = ?").get(username)
				if (saved && saved.updated_version === 1) {
					return fetchUserFromCombined(saved.user_id, username)
				} else if (saved && saved.updated_version >= 2) {
					return fetchUserFromSaved(saved)
				} else if (assistantSwitcher.enabled()) {
					return assistantSwitcher.requestUser(username).catch(error => {
						if (error === constants.symbols.NO_ASSISTANTS_AVAILABLE) throw constants.symbols.RATE_LIMITED
						else throw error
					})
				}
			}
			throw error
		})
	}
	throw new Error(`Selected fetch mode ${mode} was unmatched.`)
}

let returnmebro;

/**
 * @param {string} username
 * @returns {Promise<{user: import("./structures/User"), quotaUsed: number}>}
 */
function fetchUserFromHTML(username) {
	if (username == 'null') {
		console.error('ERROR: null passed to fetchUserFromHTML with trace:')
		console.trace()
	}
	const blockedCacheConfig = constants.caching.self_blocked_status.user_html
	if (blockedCacheConfig) {
		if (history.store.has("user")) {
			const entry = history.store.get("user")
			if (!entry.lastRequestSuccessful && Date.now() < entry.lastRequestAt + blockedCacheConfig.time) {
				return Promise.reject(entry.kind || constants.symbols.RATE_LIMITED)
			}
		}
	}
	//console.log(userRequestCache)
	return userRequestCache.getOrFetch("user/" + username, false, true, () => {
		// get uid for tiktok username


		return switcher.request("tiktok_username_html", 'https://www.tiktok.com/@' + username, { 'userAgent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)' }, async res => {
			//console.log(res)
		}).then(async g => {
			//const res = await g.response()
			const text = await g.text();
			const user_id = text.match(/(:\/\/user\/profile\/)(\d+)/)[2]
			let p = new URLSearchParams();
			p.set('user_id', user_id);
			addTikTokParams2(p);
			return [p, user_id];
		}).then(async arr => {
			let returnme2;
			//const promiseHell = () => {


			await switcher.request("tiktok_user_meta", `${constants.tiktok._API_PREFIX_ALT}v1/user/?${arr[0].toString()}`, { 'userAgent': 'AwemeI18n/xx.yy.zz (iPhone; iOS 15.0.1; Scale/2.00)' }, async res => {
				//console.log(res);
			}).then(resp => resp.json())
				.then(async json => {
					arr.push(json)
					//console.log(json.user)
					//const TTUser = require('./structures/TiktokUser')
					//const user = new TTUser(json.user)
					//console.log(user)
					//return TTUser
					//console.log(p)



					//console.log(arr)

					// @ts-ignore
					await backOff(() => switcher.request("tiktok_user_videos", `${constants.tiktok._API_PREFIX_ALT}v1/aweme/post/?${getParamsForVideoList(arr[0].get('user_id')).toString()}`, { 'userAgent': 'com.ss.android.ugc.trill/291 (Linux; U; Android 10; en_US; Pixel 4; Build/QQ3A.200805.001; Cronet/58.0.2991.0)', 'cookie': 'odin_tt=a' }, async res => {

					})
						/*
						.then(resp => {
							console.log(resp)
							
							//if (!(Number(resp.headers.get("content-length")) > 0)) {
							//	return Promise.reject("Tiktok returned a 0-byte response");
							//}
						})*/

						.then(resp => resp.json()).then(json2 => {
							//console.log(json2)
							if (typeof json2 == "string") {

								console.log("tiktok gave a 0 byte response!")
								return Promise.reject("Tiktok returned a 0-byte response");
							}
							//console.log(json2);
							arr.push(json2)

						}).then(async finaljson => {
							const TTUser = require('./structures/TiktokUser')
							const user = await new TTUser(arr[2], arr[3])
							//console.log(user)
							//console.log
							return user
						}).then(u => { returnme2 = u }), { retry: (e, num) => { console.log(e); return true; } })
					//let x = makeUser()
					//console.log("THIS IS MAKEUSER")
					//console.log(x)
					//return x



				}).then(u => {
					//console.log("THIS IS U")
					//console.log(u)
					// u;
					//console.log(returnme2)
					returnmebro = returnme2
					//console.log(returnme2)
					//return returnmebro;
				})
			//}
			//let poo = promiseHell()
			//console.log("THIS IS PROMISEHELL")
			//.log(poo)
			//return (poo);
			//console.log(returnmebro);
			//})
			return returnmebro;

		})







		return switcher.request("user_html", `https://www.instagram.com/${username}/feed/`, { "testoptions": "abcd" }, async res => {
			if (res.status === 301) throw constants.symbols.ENDPOINT_OVERRIDDEN
			if (res.status === 302) throw constants.symbols.INSTAGRAM_DEMANDS_LOGIN
			if (res.status === 429) throw constants.symbols.RATE_LIMITED
			return res
		}).then(async g => {
			const res = await g.response()
			if (res.status === 404) {
				throw constants.symbols.NOT_FOUND
			} else {
				const text = await g.text()
				// require down here or have to deal with require loop. require cache will take care of it anyway.
				// User -> Timeline -> TimelineEntry -> collectors -/> User
				const User = require("./structures/User")
				const result = extractSharedData(text)
				if (result.status === constants.symbols.extractor_results.SUCCESS) {
					const sharedData = result.value
					const user = new User(sharedData.entry_data.ProfilePage[0].graphql.user)
					history.report("user", true)
					if (constants.caching.db_user_id) {
						const existing = db.prepare("SELECT created, updated_version FROM Users WHERE username = ?").get(user.data.username)
						db.prepare(
							"REPLACE INTO Users (username,  user_id,  created,  updated,  updated_version,  biography,  post_count,  following_count,  followed_by_count,  external_url,  full_name,  is_private,  is_verified,  profile_pic_url) VALUES "
							+ "(@username, @user_id, @created, @updated, @updated_version, @biography, @post_count, @following_count, @followed_by_count, @external_url, @full_name, @is_private, @is_verified, @profile_pic_url)"
						).run({
							username: user.data.username,
							user_id: user.data.id,
							created: existing && existing.updated_version === constants.database_version ? existing.created : Date.now(),
							updated: Date.now(),
							updated_version: constants.database_version,
							biography: user.data.biography || null,
							post_count: user.posts || 0,
							following_count: user.following || 0,
							followed_by_count: user.followedBy || 0,
							external_url: user.data.external_url || null,
							full_name: user.data.full_name || null,
							is_private: +user.data.is_private,
							is_verified: +user.data.is_verified,
							profile_pic_url: user.data.profile_pic_url
						})
					}
					return user
				} else if (result.status === constants.symbols.extractor_results.AGE_RESTRICTED) {
					// I don't like this code.
					history.report("user", true)
					throw constants.symbols.extractor_results.AGE_RESTRICTED
				} else {
					throw result.status
				}
			}
		}).catch(error => {
			if (error === constants.symbols.INSTAGRAM_DEMANDS_LOGIN || error === constants.symbols.RATE_LIMITED) {
				history.report("user", false, error)
			}
			throw error
		})
	}).then(user => ({ user, quotaUsed: 0 }))
}

/**
 * @param {string} userID
 */
function updateProfilePictureFromReel(userID) {
	const p = new URLSearchParams()
	p.set("query_hash", constants.external.reel_query_hash)
	p.set("variables", JSON.stringify({
		user_id: userID,
		include_reel: true
	}))
	return switcher.request("reel_graphql", `https://www.instagram.com/graphql/query/?${p.toString()}`, null, async res => {
		if (res.status === 429) throw constants.symbols.RATE_LIMITED
		return res
	}).then(res => res.json()).then(root => {
		const result = root.data.user
		if (!result) throw constants.symbols.NOT_FOUND
		const profilePicURL = result.reel.user.profile_pic_url
		if (!profilePicURL) throw constants.symbols.NOT_FOUND
		db.prepare("UPDATE Users SET profile_pic_url = ? WHERE user_id = ?").run(profilePicURL, userID)
		for (const entry of userRequestCache.cache.values()) {
			// yes, data.data is correct.
			if (entry.data && entry.data.data && entry.data.data.id === userID) {
				entry.data.data.profile_pic_url = profilePicURL
				entry.data.computeProxyProfilePic()
				break // stop checking entries from the cache since we won't find any more
			}
		}
		return profilePicURL
	}).catch(error => {
		throw error
	})
}

/**
 * @param {string} userID
 * @param {string} username
 * @returns {Promise<{user: import("./structures/ReelUser")|import("./structures/User"), quotaUsed: number}>}
 */
function fetchUserFromCombined(userID, username) {
	// Fetch basic user information
	const p = new URLSearchParams()
	p.set("query_hash", constants.external.reel_query_hash)
	p.set("variables", JSON.stringify({
		user_id: userID,
		include_reel: true
	}))
	return userRequestCache.getOrFetch("user/" + username, true, false, () => {
		return switcher.request("reel_graphql", `https://www.instagram.com/graphql/query/?${p.toString()}`, null, async res => {
			if (res.status === 429) throw constants.symbols.RATE_LIMITED
			return res
		}).then(res => res.json()).then(root => {
			const result = root.data.user
			if (!result) {
				// user ID doesn't exist.
				db.prepare("DELETE FROM Users WHERE user_id = ?").run(userID) // deleting the entry makes sense to me; the username might be claimed by somebody else later
				throw constants.symbols.NOT_FOUND // this should cascade down and show the user not found page
			}
			// require down here or have to deal with require loop. require cache will take care of it anyway.
			// ReelUser -> Timeline -> TimelineEntry -> collectors -/> User
			const ReelUser = require("./structures/ReelUser")
			const user = new ReelUser(result.reel.user)
			history.report("reel", true)
			return user
		})
	}).then(async user => {
		// Add first timeline page
		let quotaUsed = 0
		if (!user.timeline.pages[0]) {
			const fetched = await fetchTimelinePage(userID, "")
			if (!fetched.fromCache) quotaUsed++
			user.timeline.addPage(fetched.result)
		}
		return { user, quotaUsed }
	}).catch(error => {
		if (error === constants.symbols.RATE_LIMITED) {
			history.report("reel", false, error)
		}
		throw error
	})
}

function fetchUserFromSaved(saved) {
	let quotaUsed = 0
	return userRequestCache.getOrFetch("user/" + saved.username, false, true, async () => {
		// require down here or have to deal with require loop. require cache will take care of it anyway.
		// ReelUser -> Timeline -> TimelineEntry -> collectors -/> ReelUser
		const ReelUser = require("./structures/ReelUser")
		const user = new ReelUser({
			username: saved.username,
			id: saved.user_id,
			biography: saved.biography,
			edge_follow: { count: saved.following_count },
			edge_followed_by: { count: saved.followed_by_count },
			external_url: saved.external_url,
			full_name: saved.full_name,
			is_private: !!saved.is_private,
			is_verified: !!saved.is_verified,
			profile_pic_url: saved.profile_pic_url
		})
		// Add first timeline page
		if (!user.timeline.pages[0]) {
			const { result: page, fromCache } = await fetchTimelinePage(user.data.id, "")
			if (!fromCache) quotaUsed++
			user.timeline.addPage(page)
		}
		return user
	}).then(user => {
		return { user, quotaUsed }
	})
}

/**
 * @param {string} userID
 * @param {string} after
 * @returns {Promise<{result: import("./types").PagedEdges<import("./types").TimelineEntryN2>, fromCache: boolean}>}
 */
function fetchTimelinePage(userID, after) {
	const blockedCacheConfig = constants.caching.self_blocked_status.timeline_graphql
	if (blockedCacheConfig) {
		if (history.store.has("timeline")) {
			const entry = history.store.get("timeline")
			if (!entry.lastRequestSuccessful && Date.now() < entry.lastRequestAt + blockedCacheConfig.time) {
				return Promise.reject(entry.kind || constants.symbols.RATE_LIMITED)
			}
		}
	}

	//console.log("Getting next page of " + userID + " and cursor " + after)
	//console.trace()
	/** 
	const p = new URLSearchParams()
	p.set("query_hash", constants.external.timeline_query_hash)
	p.set("variables", JSON.stringify({
		id: userID,
		first: constants.external.timeline_fetch_first,
		after: after
	}))
	return requestCache.getOrFetchPromise(`page/${userID}/${after}`, () => {
		return switcher.request("timeline_graphql", `https://www.instagram.com/graphql/query/?${p.toString()}`, {}, async res => {
			if (res.status === 302) throw constants.symbols.INSTAGRAM_BLOCK_TYPE_DECEMBER
			if (res.status === 429) throw constants.symbols.RATE_LIMITED
		}).then(g => g.json()).then(root => {
			if (root.data.user === null) {
				// user ID doesn't exist.
				db.prepare("DELETE FROM Users WHERE user_id = ?").run(userID) // deleting the entry makes sense to me; the username might be claimed by somebody else later
				requestCache
				throw constants.symbols.NOT_FOUND // this should cascade down and show the user not found page
			}
			/** @type {import("./types").PagedEdges<import("./types").TimelineEntryN2>} /*
			const timeline = root.data.user.edge_owner_to_timeline_media
			history.report("timeline", true)
			return timeline
		}).catch(error => {
			if (error === constants.symbols.RATE_LIMITED || error === constants.symbols.INSTAGRAM_BLOCK_TYPE_DECEMBER) {
				history.report("timeline", false, error)
			}
			throw error
		})
	})
	*/

	//let p = new URLSearchParams();
	//p.set('user_id', userID);
	//p.set('count', '12');
	//p.set('max_cursor', after);
	//p.set('min_cursor', '0');
	//p.set('retry_type', 'no_retry');
	//p.set('device_id', makeid(19, { 'numericalonly': 1 }))


	//try {
	return requestCache.getOrFetchPromise(`page/${userID}/${after}`, () => {


		return backOff(() => switcher.request("tiktok_user_videos", `${constants.tiktok._API_PREFIX_ALT}v1/aweme/post/?${getParamsForVideoList(userID, after).toString()}`, { 'userAgent': 'com.ss.android.ugc.trill/291 (Linux; U; Android 10; en_US; Pixel 4; Build/QQ3A.200805.001; Cronet/58.0.2991.0)', 'cookie': 'odin_tt=a' }, async res => {

		}).then(resp => resp.json()).then(root => {
			//console.log("typeof paging json is " + typeof root)
			if (typeof root == "string") {
				console.log("Tiktok returned a 0-byte response while paging")
				return Promise.reject("Tiktok returned a 0-byte response");
			}
			const timeline = root.aweme_list || null
			const cursor = root.max_cursor
			const shouldStopPaging = (root.aweme_list == null)
			//console.log("should stop paging is " + shouldStopPaging)
			history.report("timeline", true)
			return [timeline, cursor, shouldStopPaging]
		}).catch(error => {
			throw error
		}))
	})
	//}
	//catch (e) {
	//	console.log(e)
	//}
}

/**
 * @param {string} userID
 * @param {string} after
 * @returns {Promise<{result: import("./types").PagedEdges<import("./types").TimelineEntryN2>, fromCache: boolean}>}
 */
function fetchIGTVPage(userID, after) {
	const p = new URLSearchParams()
	p.set("query_hash", constants.external.igtv_query_hash)
	p.set("variables", JSON.stringify({
		id: userID,
		first: constants.external.igtv_fetch_first,
		after: after
	}))
	return requestCache.getOrFetchPromise(`igtv/${userID}/${after}`, () => {
		// assuming this uses the same bucket as timeline, which may not be the case
		return switcher.request("timeline_graphql", `https://www.instagram.com/graphql/query/?${p.toString()}`, null, async res => {
			if (res.status === 302) throw constants.symbols.INSTAGRAM_BLOCK_TYPE_DECEMBER
			if (res.status === 429) throw constants.symbols.RATE_LIMITED
		}).then(g => g.json()).then(root => {
			/** @type {import("./types").PagedEdges<import("./types").TimelineEntryN2>} */
			const timeline = root.data.user.edge_felix_video_timeline
			history.report("igtv", true)
			return timeline
		}).catch(error => {
			if (error === constants.symbols.RATE_LIMITED || error === constants.symbols.INSTAGRAM_BLOCK_TYPE_DECEMBER) {
				history.report("igtv", false, error)
			}
			throw error
		})
	})
}

/**
 * @param {string} userID
 * @param {string} username
 * @returns {Promise<{result: boolean, fromCache: boolean}>}
 */
function verifyUserPair(userID, username) {
	// Fetch basic user information
	const p = new URLSearchParams()
	p.set("query_hash", constants.external.reel_query_hash)
	p.set("variables", JSON.stringify({
		user_id: userID,
		include_reel: true
	}))
	return requestCache.getOrFetchPromise("userID/" + userID, () => {
		return switcher.request("reel_graphql", `https://www.instagram.com/graphql/query/?${p.toString()}`, null, async res => {
			if (res.status === 302) throw constants.symbols.INSTAGRAM_BLOCK_TYPE_DECEMBER
			if (res.status === 429) throw constants.symbols.RATE_LIMITED
			return res
		}).then(res => res.json()).then(root => {
			let user = root.data.user
			if (!user) throw constants.symbols.NOT_FOUND
			user = user.reel.user
			history.report("reel", true)
			return user.id === userID && user.username === username
		}).catch(error => {
			throw error
		})
	})
}

/**
 * @param {string} shortcode
 * @returns {import("./structures/TimelineEntry")}
 */
function getOrCreateShortcode(shortcode) {
	//console.log(timelineEntryCache)
	if (timelineEntryCache.has(shortcode)) {
		console.log("cache has shortcode")
		return timelineEntryCache.get(shortcode)
	} else {
		// require down here or have to deal with require loop. require cache will take care of it anyway.
		// TimelineEntry -> collectors -/> TimelineEntry
		//console.log("cache missing shortcode")
		const TimelineEntry = require("./structures/TimelineEntry")
		const result = new TimelineEntry()
		timelineEntryCache.set(shortcode, result)
		return result
	}
}

async function getOrFetchShortcode(shortcode) {
	if (timelineEntryCache.has(shortcode)) {
		// console.log("timeline cache has shortcode")
		return { post: timelineEntryCache.get(shortcode), fromCache: true }
	} else {
		const { result, fromCache } = await fetchShortcodeData(shortcode)
		const entry = getOrCreateShortcode(shortcode)
		entry.applyN3(result)
		return { post: entry, fromCache }
	}
}

/**
 * @param {string} video_id
 * @returns {Promise<{result: import("./types").TimelineEntryN3, fromCache: boolean}>}
 */
function fetchShortcodeData(video_id) {
	// example actual query from web:
	// query_hash=2b0673e0dc4580674a88d426fe00ea90&variables={"shortcode":"xxxxxxxxxxx","child_comment_count":3,"fetch_comment_count":40,"parent_comment_count":24,"has_threaded_comments":true}
	// we will not include params about comments, which means we will not receive comments, but everything else should still work fine
	const p = new URLSearchParams()
	p.set("aweme_id", video_id)
	addTikTokParams(p)

	return requestCache.getOrFetchPromise("shortcode/" + video_id, () => {


		return switcher.request("tiktok_video_detail", `${constants.tiktok._API_PREFIX_ALT}v1/aweme/detail/?${p.toString()}`, { 'userAgent': 'com.ss.android.ugc.trill/291 (Linux; U; Android 10; en_US; Pixel 4; Build/QQ3A.200805.001; Cronet/58.0.2991.0)', 'cookie': 'odin_tt=a' }, async res => {

		}).then(resp => resp.json()).then(root => {
			if (typeof root.aweme_detail == "undefined") {
				throw constants.symbols.NOT_FOUND
			} else {
				const aweme_data = root.aweme_detail
				history.report("post", true)
				if (constants.caching.db_post_n3) {
					db.prepare("REPLACE INTO Posts (shortcode, id, id_as_numeric, username, json) VALUES (@shortcode, @id, @id_as_numeric, @username, @json)")
						// TODO: remove shortcode field in db
						.run({ shortcode: aweme_data.aweme_id, id: aweme_data.aweme_id, id_as_numeric: aweme_data.aweme_id, username: aweme_data.author.unique_id, json: JSON.stringify(aweme_data) })
				}
				return aweme_data
			}
		}).catch(error => {
			throw error
		})
	})

}

function addTikTokParams(params) {
	if (!(params instanceof URLSearchParams)) {
		throw new Error('pass URLSearchParams')
	}

	const paramsToAdd = {
		'version_name': constants.tiktok._APP_VERSION,
		'version_code': constants.tiktok._MANIFEST_APP_VERSION,
		'build_number': constants.tiktok._APP_VERSION,
		'manifest_version_code': constants.tiktok._MANIFEST_APP_VERSION,
		'update_version_code': constants.tiktok._MANIFEST_APP_VERSION,
		'openudid': makeid(16, { 'numericalonly': 0 }),
		'uuid': makeid(16, { 'numericalonly': 1 }),
		'_rticket': new Date().getTime(),
		'ts': (new Date().getTime() + '').substr(0, 10),
		'device_brand': 'Google',
		'device_type': 'Pixel 4',
		'device_platform': 'android',
		'resolution': '1080*1920',
		'dpi': 420,
		'os_version': '10',
		'os_api': '29',
		'carrier_region': 'US',
		'sys_region': 'US',
		'region': 'US',
		'app_name': 'trill',
		'app_language': 'en',
		'language': 'en',
		'timezone_name': 'America/New_York',
		'timezone_offset': '-14400',
		'channel': 'googleplay',
		'ac': 'wifi',
		'mcc_mnc': '310260',
		'is_my_cn': 0,
		'aid': 1180,
		'ssmix': 'a',
		'as': 'a1qwert123',
		'cp': 'cbfhckdckkde1'
	}
	// https://stackoverflow.com/questions/40047488
	for (let key in paramsToAdd) {
		if (paramsToAdd.hasOwnProperty(key)) {
			params.set(key, paramsToAdd[key])
		}
	}
	//return params;
}

function getParamsForVideoList(uid, cursor = "0") {
	let p = new URLSearchParams();
	//p.set('user_id', arr[1].toString());
	p.set('user_id', uid)
	p.set('count', '12');
	p.set('max_cursor', cursor);
	p.set('min_cursor', '0');
	p.set('retry_type', 'no_retry');
	p.set('device_id', makeid(19, { 'numericalonly': 1 }))
	addTikTokParams(p);
	return p;
}

function addTikTokParams2(params) {
	if (!(params instanceof URLSearchParams)) {
		throw new Error('pass URLSearchParams')
	}
	//let copy = params;
	const paramsToAdd = {
		'version_code': '2.7.0',
		'app_name': 'trill',
		'channel': 'a',
		'aid': 1180,
		'os_version': '15.0.1',
		'device_id': constants.tiktok.deviceParams[0].device_id,
		'iid': constants.tiktok.deviceParams[0].iid,
		'device_platform': constants.tiktok.deviceParams[0].device_platform,
		'device_type': constants.tiktok.deviceParams[0].device_type
	}
	for (let key in paramsToAdd) {
		if (paramsToAdd.hasOwnProperty(key)) {
			params.set(key, paramsToAdd[key])
		}
	}
	//return params;
}

function makeid(length, opts) {
	let result = '';
	let characters = '0123456789abcdef';
	opts.numericalonly && (characters = "0123456789");
	let charactersLength = characters.length;
	for (let i = 0; i < length; i++) {
		result += characters.charAt(Math.floor(Math.random() *
			charactersLength));
	}
	return result;
}

module.exports.fetchUser = fetchUser
module.exports.fetchTimelinePage = fetchTimelinePage
module.exports.fetchIGTVPage = fetchIGTVPage
module.exports.getOrCreateShortcode = getOrCreateShortcode
module.exports.fetchShortcodeData = fetchShortcodeData
module.exports.requestCache = requestCache
module.exports.userRequestCache = userRequestCache
module.exports.timelineEntryCache = timelineEntryCache
module.exports.getOrFetchShortcode = getOrFetchShortcode
module.exports.updateProfilePictureFromReel = updateProfilePictureFromReel
module.exports.history = history
module.exports.fetchUserFromSaved = fetchUserFromSaved
module.exports.assistantSwitcher = assistantSwitcher
module.exports.verifyUserPair = verifyUserPair
