try {
	var got = require("got").default
} catch (e) { }

class Got {
	constructor(url, options, stream) {
		if (!got) throw new Error("`got` is not installed, either install it or set a different request backend.")
		this.url = url
		this.options = options
	}

	stream() {
		delete this.options.url // options.url cannot be present https://github.com/sindresorhus/got/issues/1118#issuecomment-598466997
		return Promise.resolve(got.stream(this.url, this.options))
	}

	send() {
		if (!this.instance) {
			this.instance = got(this.url, this.options)
		}
		return this
	}

	/**
	 * @returns {Promise<import("./reference").GrabResponse>}
	 */
	response() {
		return this.send().instance.then(res => ({
			status: res.statusCode,
			headers: new Map(Object.entries(res.headers)),
			//bodyaaa: res.body
		}))
	}

	async check(test) {
		await this.send().response().then(res => test(res))
		return this
	}

	json() {
		return this.send().instance.json()
	}

	text() {
		return this.send().instance.text()
	}
}

module.exports = Got
