const express = require("express");
const mongoose = require("mongoose");

const router = express.Router();

const ReadState =
  require("../models/ReadState");

const Message =
  require("../models/Message");

const Room =
  require("../models/Room");

const User =
  require("../models/User");

const authMiddleware =
  require("../middleware/authMiddleware");

// =========================================================
// HELPERS
// =========================================================

const isValidObjectId = (value) =>
  mongoose.Types.ObjectId.isValid(
    value
  );

// =========================================================
// GET UNREAD COUNTS
// GET /api/read-state
// =========================================================

router.get(
  "/",
  authMiddleware,
  async (req, res) => {
    try {
      const userId =
        new mongoose.Types.ObjectId(
          req.user.id
        );

      // -----------------------------------------------------
      // READ STATES
      // -----------------------------------------------------

      const readStates =
        await ReadState.find({
          user: userId,
        })
          .select(
            "scopeType target lastReadAt"
          )
          .lean();

      const privateReadStates =
        new Map();

      const roomReadStates =
        new Map();

      for (
        const state of readStates
      ) {
        const target =
          String(
            state.target
          );

        if (
          state.scopeType ===
          "private"
        ) {
          privateReadStates.set(
            target,
            state.lastReadAt
          );
        }

        if (
          state.scopeType ===
          "room"
        ) {
          roomReadStates.set(
            target,
            state.lastReadAt
          );
        }
      }

      // =====================================================
      // PRIVATE UNREAD
      // =====================================================

      const privateMessages =
        await Message.find({
          receiver: userId,
          roomId: null,
        })
          .select(
            "sender createdAt"
          )
          .lean();

      const privateUnread = {};

      for (
        const message of privateMessages
      ) {
        const senderId =
          String(
            message.sender
          );

        const lastReadAt =
          privateReadStates.get(
            senderId
          );

        const unread =
          !lastReadAt ||
          new Date(
            message.createdAt
          ) >
            new Date(
              lastReadAt
            );

        if (!unread) {
          continue;
        }

        privateUnread[
          senderId
        ] =
          (
            privateUnread[
              senderId
            ] || 0
          ) + 1;
      }

      // =====================================================
      // USER ROOMS
      // =====================================================

      const rooms =
        await Room.find({
          members: userId,
        })
          .select("_id")
          .lean();

      const roomIds =
        rooms.map(
          (room) =>
            String(
              room._id
            )
        );

      const roomUnread = {};

      // =====================================================
      // ROOM UNREAD
      // =====================================================

      if (
        roomIds.length > 0
      ) {
        const roomMessages =
          await Message.find({
            roomId: {
              $in: roomIds,
            },

            sender: {
              $ne: userId,
            },
          })
            .select(
              "roomId createdAt"
            )
            .lean();

        for (
          const message of roomMessages
        ) {
          const roomId =
            String(
              message.roomId
            );

          const lastReadAt =
            roomReadStates.get(
              roomId
            );

          const unread =
            !lastReadAt ||
            new Date(
              message.createdAt
            ) >
              new Date(
                lastReadAt
              );

          if (!unread) {
            continue;
          }

          roomUnread[
            roomId
          ] =
            (
              roomUnread[
                roomId
              ] || 0
            ) + 1;
        }
      }

      return res.status(200).json({
        private:
          privateUnread,

        rooms:
          roomUnread,
      });
    } catch (error) {
      console.error(
        "[READ STATE] Get unread counts error:",
        error
      );

      return res.status(500).json({
        message:
          "Failed to load unread counts",
      });
    }
  }
);

// =========================================================
// MARK PRIVATE CHAT READ
// POST /api/read-state/private/:userId
// =========================================================

router.post(
  "/private/:userId",
  authMiddleware,
  async (req, res) => {
    try {
      const userId =
        String(
          req.user.id
        );

      const otherUserId =
        String(
          req.params.userId
        );

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

      if (
        userId ===
        otherUserId
      ) {
        return res.status(400).json({
          message:
            "Invalid conversation",
        });
      }

      const userExists =
        await User.exists({
          _id:
            otherUserId,
        });

      if (!userExists) {
        return res.status(404).json({
          message:
            "User not found",
        });
      }

      const lastReadAt =
        new Date();

      const state =
        await ReadState.findOneAndUpdate(
          {
            user:
              userId,

            scopeType:
              "private",

            target:
              otherUserId,
          },
          {
            $set: {
              lastReadAt,
            },
          },
          {
            upsert:
              true,

            returnDocument:
              "after",

            setDefaultsOnInsert:
              true,
          }
        );

      return res.status(200).json({
        message:
          "Private chat marked as read",

        lastReadAt:
          state.lastReadAt,
      });
    } catch (error) {
      console.error(
        "[READ STATE] Mark private read error:",
        error
      );

      return res.status(500).json({
        message:
          "Failed to mark private chat as read",
      });
    }
  }
);

// =========================================================
// MARK ROOM READ
// POST /api/read-state/room/:roomId
// =========================================================

router.post(
  "/room/:roomId",
  authMiddleware,
  async (req, res) => {
    try {
      const userId =
        String(
          req.user.id
        );

      const roomId =
        String(
          req.params.roomId
        );

      if (
        !isValidObjectId(
          roomId
        )
      ) {
        return res.status(400).json({
          message:
            "Invalid room ID",
        });
      }

      const room =
        await Room.findOne({
          _id:
            roomId,

          members:
            userId,
        })
          .select("_id")
          .lean();

      if (!room) {
        return res.status(403).json({
          message:
            "You are not a member of this room",
        });
      }

      const lastReadAt =
        new Date();

      const state =
        await ReadState.findOneAndUpdate(
          {
            user:
              userId,

            scopeType:
              "room",

            target:
              roomId,
          },
          {
            $set: {
              lastReadAt,
            },
          },
          {
            upsert:
              true,

            returnDocument:
              "after",

            setDefaultsOnInsert:
              true,
          }
        );

      return res.status(200).json({
        message:
          "Room marked as read",

        lastReadAt:
          state.lastReadAt,
      });
    } catch (error) {
      console.error(
        "[READ STATE] Mark room read error:",
        error
      );

      return res.status(500).json({
        message:
          "Failed to mark room as read",
      });
    }
  }
);

module.exports =
  router;