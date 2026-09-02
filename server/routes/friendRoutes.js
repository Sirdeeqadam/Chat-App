const express = require("express");
const mongoose = require("mongoose");

const Friendship = require("../models/Friendship");
const User = require("../models/User");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();
const USER_FIELDS = "_id username email language bio profilePicture createdAt updatedAt";
const currentUserId = (req) => String(req.user.id);

router.get("/all", authMiddleware, async (req, res) => {
  try {
    const users = await User.find({
      _id: { $ne: currentUserId(req) },
    }).select(USER_FIELDS).sort({ username: 1 }).lean();

    const relationships = await Friendship.find({
      $or: [{ requester: currentUserId(req) }, { recipient: currentUserId(req) }],
    }).lean();

    return res.json(users.map((user) => {
      const relationship = relationships.find((item) =>
        String(item.requester) === String(user._id) || String(item.recipient) === String(user._id)
      );
      return {
        ...user,
        relationship: relationship
          ? relationship.status === "accepted"
            ? "friends"
            : String(relationship.requester) === currentUserId(req) ? "outgoing" : "incoming"
          : "none",
        friendshipId: relationship?._id || null,
      };
    }));
  } catch (error) {
    console.error("Get all users error:", error);
    return res.status(500).json({ message: "Failed to load users." });
  }
});

router.get("/search", authMiddleware, async (req, res) => {
  try {
    const query = String(req.query.q || "").trim();
    if (query.length < 2) return res.json([]);

    const users = await User.find({
      _id: { $ne: currentUserId(req) },
      $or: [
        { username: { $regex: query, $options: "i" } },
        { email: { $regex: query, $options: "i" } },
      ],
    }).select(USER_FIELDS).sort({ username: 1 }).limit(20).lean();

    const relationships = await Friendship.find({
      $or: [{ requester: currentUserId(req) }, { recipient: currentUserId(req) }],
    }).lean();

    return res.json(users.map((user) => {
      const relationship = relationships.find((item) =>
        String(item.requester) === String(user._id) || String(item.recipient) === String(user._id)
      );
      return {
        ...user,
        relationship: relationship
          ? relationship.status === "accepted"
            ? "friends"
            : String(relationship.requester) === currentUserId(req) ? "outgoing" : "incoming"
          : "none",
        friendshipId: relationship?._id || null,
      };
    }));
  } catch (error) {
    console.error("Friend search error:", error);
    return res.status(500).json({ message: "Failed to search users." });
  }
});

router.get("/", authMiddleware, async (req, res) => {
  try {
    const relationships = await Friendship.find({
      $or: [{ requester: currentUserId(req) }, { recipient: currentUserId(req) }],
    }).populate("requester recipient", USER_FIELDS).sort({ updatedAt: -1 }).lean();

    return res.json(relationships.map((item) => ({
      ...item,
      user: String(item.requester?._id) === currentUserId(req) ? item.recipient : item.requester,
      direction: String(item.recipient?._id) === currentUserId(req) ? "incoming" : "outgoing",
    })));
  } catch (error) {
    console.error("Friend list error:", error);
    return res.status(500).json({ message: "Failed to load friends." });
  }
});

router.post("/requests/:targetId", authMiddleware, async (req, res) => {
  const requester = currentUserId(req);
  const recipient = String(req.params.targetId);
  if (!mongoose.Types.ObjectId.isValid(recipient) || requester === recipient) {
    return res.status(400).json({ message: "Invalid friend request." });
  }

  try {
    const target = await User.findById(recipient).select("_id").lean();
    if (!target) return res.status(404).json({ message: "User not found." });

    const existing = await Friendship.findOne({
      $or: [{ requester, recipient }, { requester: recipient, recipient: requester }],
    });
    if (existing) return res.status(409).json({ message: existing.status === "accepted" ? "You are already friends." : "A friend request already exists." });

    await Friendship.create({ requester, recipient });
    return res.status(201).json({ message: "Friend request sent." });
  } catch (error) {
    console.error("Send friend request error:", error);
    return res.status(500).json({ message: "Failed to send friend request." });
  }
});

router.patch("/requests/:requestId", authMiddleware, async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.requestId)) return res.status(400).json({ message: "Invalid request." });
  try {
    const request = await Friendship.findOne({ _id: req.params.requestId, recipient: currentUserId(req), status: "pending" });
    if (!request) return res.status(404).json({ message: "Friend request not found." });
    if (req.body?.action === "decline") {
      await request.deleteOne();
      return res.json({ message: "Friend request declined." });
    }
    request.status = "accepted";
    await request.save();
    return res.json({ message: "Friend request accepted." });
  } catch (error) {
    console.error("Update friend request error:", error);
    return res.status(500).json({ message: "Failed to update friend request." });
  }
});

module.exports = router;