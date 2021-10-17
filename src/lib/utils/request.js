const NodeFetch = require("./request_backends/node-fetch")
const Got = require("./request_backends/got")
const SavedRequestManager = require("./saved_requests/manager")

const constants = require("../constants")

const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.169 Safari/537.36"

const { HttpProxyAgent, HttpsProxyAgent } = require('hpagent')

const backendStatusLineMap = new Map([
	["node-fetch", "NF "],
	["got", "GOT"],
	["saved", "SAV"]
])

/**
 * @returns {import("./request_backends/reference")}
 */
function request(url, options = {}, settings = {}) {
	if (settings.statusLine === undefined) settings.statusLine = "OUT"
	if (settings.log === undefined) settings.log = true
	if (settings.log) console.log(`      -> [${settings.statusLine}-${backendStatusLineMap.get(constants.request_backend)}] ${url}`) // todo: make more like pinski?
	const save = !!settings.save
	//console.log(options)
	if (constants.request_backend === "node-fetch") {
		return new NodeFetch(url, Object.assign({
			headers: {
				"User-Agent": userAgent
			},
			redirect: "manual"
		}, options))
	} else if (constants.request_backend === "got") {
		//let assignmetoua = userAgent;
		//try { options.userAgent && (assignmetoua = options.userAgent); } catch (e) { }
		return new Got(url, Object.assign({
			headers: {
				"User-Agent": options.userAgent,
				"Cookie": options.cookie,
				"Range": ""
			},
			followRedirect: false,
			throwHttpErrors: false,
			/// below is for fiddler debugging
			///*
			agent: {
				http: new HttpProxyAgent({
					keepAlive: true,
					keepAliveMsecs: 1000,
					maxSockets: 256,
					maxFreeSockets: 256,
					scheduling: 'lifo',
					proxy: 'http://' + process.env.hostip + ':8888'
				}),
				https: new HttpsProxyAgent({
					keepAlive: true,
					keepAliveMsecs: 1000,
					maxSockets: 256,
					maxFreeSockets: 256,
					scheduling: 'lifo',
					proxy: 'http://' + process.env.hostip + ':8888',
					rejectUnauthorized: false
				})

			}
			//*/
		}, options))
	} else if (constants.request_backend === "saved") {
		return new SavedRequestManager(url).request()
	} else {
		throw new Error("Invalid value for setting `request_backend`.")
	}
}

module.exports.request = request
