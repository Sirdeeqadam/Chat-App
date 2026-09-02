const express = require("express");

const Friendship = require("../models/Friendship");
const Message = require("../models/Message");
const Room = require("../models/Room");
const User = require("../models/User");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();
const USER_FIELDS = "_id username email language bio profilePicture";
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const getUserId = (req) => String(req.user.id);

router.get("/", authMiddleware, async (req, res) => {
  try {
    const query = String(req.query.q || "").trim();
    if (query.length < 2) {
      return res.json({ friends: [], groups: [], messages: [], links: [] });
    }

    const userId = getUserId(req);
    const pattern = new RegExp(escapeRegex(query), "i");
    const relationships = await Friendship.find({
      status: "accepted",
      $or: [{ requester: userId }, { recipient: userId }],
    }).lean();
    const friendIds = relationships.map((item) =>
      String(item.requester) === userId ? item.recipient : item.requester
    );
    const memberRooms = await Room.find({ members: userId }).select("_id").lean();
    const memberRoomIds = memberRooms.map((room) => String(room._id));

    const [friends, groups, messages] = await Promise.all([
      User.find({
        _id: { $in: friendIds },
        $or: [{ username: pattern }, { email: pattern }, { bio: pattern }],
      }).select(USER_FIELDS).sort({ username: 1 }).limit(20).lean(),
      Room.find({
        members: userId,
        $or: [{ name: pattern }, { description: pattern }, { code: pattern }],
      }).select("_id name description code members").sort({ name: 1 }).limit(20).lean(),
      Message.find({
        $and: [
          {
            $or: [
              { sender: userId },
              { receiver: userId },
              { roomId: { $in: memberRoomIds } },
            ],
          },
          {
            $or: [{ message: pattern }, { attachmentName: pattern }, { attachmentUrl: pattern }],
          },
        ],
      }).populate("sender receiver", USER_FIELDS).sort({ createdAt: -1 }).limit(50).lean(),
    ]);

    const urlPattern = /https?:\/\/[^\s<]+/gi;
    const links = messages.flatMap((message) =>
      (message.message?.match(urlPattern) || [])
        .filter((url) => pattern.test(url))
        .map((url) => ({
          id: `${message._id}-${url}`,
          url: url.replace(/[),.!?]+$/, ""),
          messageId: message._id,
          roomId: message.roomId,
          sender: message.sender,
          createdAt: message.createdAt,
        }))
    ).slice(0, 20);

    return res.json({ friends, groups, messages, links });
  } catch (error) {
    console.error("Global search error:", error);
    return res.status(500).json({ message: "Failed to search the app." });
  }
});

module.exports = router;
