const SocksProxyAgent = require("socks-proxy-agent")
const { connect } = require("net");
const constants = require("../constants")
const { request } = require("./request")
const { RequestCache } = require("../cache")

class TorManager {
	constructor(tor, port) {
	}
}


/** @type {Promise<TorManager>} */
module.exports = new Promise(resolve => {
	console.log("Note: Tor functionality was removed.")
	resolve(null)

})
