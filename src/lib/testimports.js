module.exports = function (...items) {
	items.forEach((item, index) => {
		//console.log(item)
		if (item === undefined || (item && item.constructor && item.constructor.name == "Object" && Object.keys(item).length == 0)) {
			//console.log(item)
			//console.trace();
			console.log(`Bad import for arg index ${index}`)
			// @ts-ignore
			require("/") // generate an error with a require stack.
		}
	})
}
