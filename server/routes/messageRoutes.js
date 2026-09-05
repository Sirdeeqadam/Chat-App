const express = require("express");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const router = express.Router();

const Message =
  require("../models/Message");

const ReadState =
  require("../models/ReadState");

const Friendship =
  require("../models/Friendship");

const authMiddleware =
  require("../middleware/authMiddleware");

const audioDirectory = path.join(
  __dirname,
  "..",
  "uploads",
  "audio"
);

fs.mkdirSync(audioDirectory, {
  recursive: true,
});

const audioUpload = multer({
  storage: multer.diskStorage({
    destination: audioDirectory,
    filename: (req, file, callback) => {
      const extension =
        path.extname(file.originalname) ||
        ".webm";

      callback(
        null,
        `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}${extension}`
      );
    },
  }),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (req, file, callback) => {
    const allowedTypes = [
      "audio/webm",
      "audio/ogg",
      "audio/mpeg",
      "audio/mp4",
      "audio/wav",
      "audio/x-wav",
    ];

    callback(
      null,
      allowedTypes.includes(file.mimetype)
    );
  },
});

const attachmentDirectory = path.join(
  __dirname,
  "..",
  "uploads",
  "attachments"
);

fs.mkdirSync(attachmentDirectory, {
  recursive: true,
});

const allowedAttachmentTypes = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "audio/webm",
  "audio/ogg",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/x-wav",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];

const attachmentUpload = multer({
  storage: multer.diskStorage({
    destination: attachmentDirectory,
    filename: (req, file, callback) => {
      const extension = path.extname(file.originalname) || "";
      callback(
        null,
        `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}${extension}`
      );
    },
  }),
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
  fileFilter: (req, file, callback) => {
    callback(
      null,
      allowedAttachmentTypes.includes(file.mimetype)
    );
  },
});

// =====================================================
// HELPERS
// =====================================================

const isValidObjectId = (value) =>
  mongoose.Types.ObjectId.isValid(value);

const areFriends = async (firstUserId, secondUserId) => {
  return Boolean(await Friendship.exists({
    status: "accepted",
    $or: [
      { requester: firstUserId, recipient: secondUserId },
      { requester: secondUserId, recipient: firstUserId },
    ],
  }));
};

router.post(
  "/audio",
  authMiddleware,
  (req, res) => {
    audioUpload.single("audio")(
      req,
      res,
      (error) => {
        if (error) {
          return res.status(400).json({
            message:
              error.message ||
              "Audio upload failed.",
          });
        }

        if (!req.file) {
          return res.status(400).json({
            message:
              "Audio recording is required.",
          });
        }

        return res.status(201).json({
          attachmentUrl:
            `/uploads/audio/${req.file.filename}`,
        });
      }
    );
  }
);

router.post(
  "/attachment",
  authMiddleware,
  (req, res) => {
    attachmentUpload.single("attachment")(
      req,
      res,
      (error) => {
        if (error) {
          return res.status(400).json({
            message:
              error.message ||
              "Attachment upload failed.",
          });
        }

        if (!req.file) {
          return res.status(400).json({
            message: "A file is required.",
          });
        }

        const mimeType = req.file.mimetype;
        const messageType = mimeType.startsWith("image/")
          ? "image"
          : mimeType.startsWith("audio/")
            ? "audio"
            : mimeType.startsWith("video/")
              ? "video"
              : "file";

        return res.status(201).json({
          attachmentUrl:
            `/uploads/attachments/${req.file.filename}`,
          attachmentName: req.file.originalname,
          attachmentMimeType: mimeType,
          messageType,
        });
      }
    );
  }
);

// =====================================================
// PRIVATE CHAT HISTORY
// GET /api/messages/private/:userId/:otherUserId
// =====================================================

router.get(
  "/private/recent",
  authMiddleware,
  async (req, res) => {
    try {
      const userId = new mongoose.Types.ObjectId(String(req.user.id));

      const recentChats = await Message.aggregate([
        {
          $match: {
            roomId: null,
            $or: [{ sender: userId }, { receiver: userId }],
          },
        },
        { $sort: { createdAt: -1 } },
        {
          $project: {
            otherUserId: {
              $cond: [{ $eq: ["$sender", userId] }, "$receiver", "$sender"],
            },
            lastMessageAt: "$createdAt",
          },
        },
        {
          $group: {
            _id: "$otherUserId",
            lastMessageAt: { $first: "$lastMessageAt" },
          },
        },
      ]);

      return res.json(
        recentChats.reduce((result, chat) => {
          result[String(chat._id)] = chat.lastMessageAt;
          return result;
        }, {})
      );
    } catch (error) {
      console.error("Get recent private chats error:", error);
      return res.status(500).json({ message: "Failed to load recent chats." });
    }
  }
);

router.get(
  "/private/:userId/:otherUserId",
  authMiddleware,
  async (req, res) => {
    try {
      const {
        userId,
        otherUserId,
      } = req.params;

      const authenticatedUserId =
        String(req.user.id);

      if (
        authenticatedUserId !==
        String(userId)
      ) {
        return res.status(403).json({
          message:
            "You can only access your own conversations",
        });
      }

      if (
        !isValidObjectId(userId) ||
        !isValidObjectId(otherUserId)
      ) {
        return res.status(400).json({
          message:
            "Invalid user ID",
        });
      }

      if (
        String(userId) ===
        String(otherUserId)
      ) {
        return res.status(400).json({
          message:
            "Invalid private conversation",
        });
      }

      if (!await areFriends(userId, otherUserId)) {
        return res.status(403).json({
          message: "You can only chat with accepted friends.",
        });
      }

      const messages =
        await Message.find({
          roomId: null,

          $or: [
            {
              sender: userId,
              receiver: otherUserId,
            },
            {
              sender: otherUserId,
              receiver: userId,
            },
          ],
        })
          .populate(
            "sender",
            "username email language"
          )
          .populate(
            "receiver",
            "username email language"
          )
          .sort({
            createdAt: 1,
          })
          .lean();

      return res.status(200).json(messages);
    } catch (error) {
      console.error(
        "Get private messages error:",
        error
      );

      return res.status(500).json({
        message:
          "Failed to load private messages",
      });
    }
  }
);

// =====================================================
// MARK ONE MESSAGE READ
// POST /api/messages/:messageId/read
// =====================================================

router.post(
  "/:messageId/read",
  authMiddleware,
  async (req, res) => {
    try {
      const { messageId } =
        req.params;

      const userId =
        String(req.user.id);

      if (
        !isValidObjectId(messageId)
      ) {
        return res.status(400).json({
          message:
            "Invalid message ID",
        });
      }

      const message =
        await Message.findOne({
          _id: messageId,
          receiver: userId,
          roomId: null,
        });

      if (!message) {
        return res.status(404).json({
          message:
            "Private message not found",
        });
      }

      const readAt =
        new Date();

      if (
        message.deliveryStatus !==
        "read"
      ) {
        message.deliveryStatus =
          "read";

        message.readAt =
          readAt;

        await message.save();
      }

      await ReadState.findOneAndUpdate(
        {
          user: userId,
          scopeType: "private",
          target: message.sender,
        },
        {
          $set: {
            lastReadAt: readAt,
          },
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        }
      );

      return res.status(200).json({
        message:
          "Message marked as read",

        messageId:
          String(message._id),

        deliveryStatus:
          "read",

        readAt,
      });
    } catch (error) {
      console.error(
        "Mark message read error:",
        error
      );

      return res.status(500).json({
        message:
          "Failed to mark message as read",
      });
    }
  }
);

// =====================================================
// MARK PRIVATE CONVERSATION READ
// POST /api/messages/private/:otherUserId/read
// =====================================================

router.post(
  "/private/:otherUserId/read",
  authMiddleware,
  async (req, res) => {
    try {
      const userId =
        String(req.user.id);

      const {
        otherUserId,
      } = req.params;

      if (
        !isValidObjectId(
          otherUserId
        )
      ) {
        return res.status(400).json({
          message:
            "Invalid user ID",
        });
      }

      if (!await areFriends(userId, otherUserId)) {
        return res.status(403).json({
          message: "You can only chat with accepted friends.",
        });
      }

      if (
        userId ===
        String(otherUserId)
      ) {
        return res.status(400).json({
          message:
            "Invalid private conversation",
        });
      }

      const readAt =
        new Date();

      await Message.updateMany(
        {
          sender: otherUserId,
          receiver: userId,
          roomId: null,
          deliveryStatus: {
            $ne: "read",
          },
        },
        {
          $set: {
            deliveryStatus: "read",
            readAt,
          },
        }
      );

      await ReadState.findOneAndUpdate(
        {
          user: userId,
          scopeType: "private",
          target: otherUserId,
        },
        {
          $set: {
            lastReadAt: readAt,
          },
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        }
      );

      return res.status(200).json({
        message:
          "Private messages marked as read",

        lastReadAt:
          readAt,
      });
    } catch (error) {
      console.error(
        "Mark private conversation read error:",
        error
      );

      return res.status(500).json({
        message:
          "Failed to mark conversation as read",
      });
    }
  }
);

module.exports = router;