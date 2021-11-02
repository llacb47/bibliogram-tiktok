const constants = require("../constants")
const Timeline = require("./Timeline")
const BaseUser = require("./BaseUser")
require("../testimports")(constants, Timeline, BaseUser)

class TiktokUser extends BaseUser {
    /* // no TikTokUser in types.js yet
     * @param {import("../types").GraphUser} data
     */
    constructor(data, aweme_data) {
        super()
        this.data = data
        this.aweme_list = aweme_data.aweme_list
        this.cursor = aweme_data.max_cursor
        this.following = data.user.following_count
        this.followedBy = data.user.follower_count
        this.posts = data.user.aweme_count
        // this.timeline TEMP
        // @ts-ignore
        this.timeline = new Timeline(this, "timeline")
        this.cachedAt = Date.now()
        this.computeProxyProfilePic()
        this.hasMore = true // assume true until otherwise
        // profile pics


    }

    // more elegant to use more getters and setters??

    set newCursor(val) {
        //console.trace()
        console.log("updating cursor to " + val)
        this.cursor = val;
    }
}

module.exports = TiktokUser