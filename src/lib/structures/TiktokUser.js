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
        this.aweme_data = aweme_data
        this.following = data.user.following_count
        this.followedBy = data.user.follower_count
        this.posts = data.user.aweme_count
        // this.timeline TEMP
        // @ts-ignore
        this.timeline = new Timeline(this, "timeline")
        this.cachedAt = Date.now()
        this.computeProxyProfilePic()
        // profile pics


    }
}

module.exports = TiktokUser