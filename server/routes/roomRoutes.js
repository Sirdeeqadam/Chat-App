const express = require("express");
const mongoose = require("mongoose");

const router = express.Router();

const Room = require("../models/Room");
const Message = require("../models/Message");
const ReadState = require("../models/ReadState");
const User = require("../models/User");
const {
  normalizeLanguageCode,
  translateText,
} = require("../services/translationService");

const authMiddleware =
  require("../middleware/authMiddleware");

// =====================================================
// USER FIELDS USED THROUGHOUT ROOMS
// =====================================================

const ROOM_USER_FIELDS =
  "_id username email language bio profilePicture createdAt updatedAt";

// =====================================================
// ROOM LIMITS
// =====================================================

const ROOM_NAME_MAX_LENGTH = 50;
const ROOM_DESCRIPTION_MAX_LENGTH = 500;

// =====================================================
// HELPERS
// =====================================================

const isValidObjectId = (value) =>
  mongoose.Types.ObjectId.isValid(value);

const normalizeUserId = (value) =>
  String(value || "");

const normalizeRoomCode = (value) =>
  String(value || "")
    .trim()
    .toUpperCase();

const normalizeText = (value) =>
  typeof value === "string"
    ? value.trim()
    : "";

const isValidRoomCode = (code) =>
  /^[A-Z0-9]{6}$/.test(code);

// =====================================================
// ROOM CODE GENERATOR
// =====================================================

const ROOM_CODE_CHARACTERS =
  "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const generateRoomCode = () => {
  let code = "";

  for (let i = 0; i < 6; i += 1) {
    const index = Math.floor(
      Math.random() *
        ROOM_CODE_CHARACTERS.length
    );

    code += ROOM_CODE_CHARACTERS[index];
  }

  return code;
};

const generateUniqueRoomCode = async () => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = generateRoomCode();

    const exists = await Room.exists({
      code,
    });

    if (!exists) {
      return code;
    }
  }

  throw new Error(
    "Unable to generate a unique room code."
  );
};

// =====================================================
// POPULATE ROOM
// =====================================================

const getPopulatedRoom = async (roomId) => {
  return Room.findById(roomId)
    .populate(
      "creator",
      ROOM_USER_FIELDS
    )
    .populate(
      "members",
      ROOM_USER_FIELDS
    )
    .lean();
};

// =====================================================
// CHECK ROOM MEMBERSHIP
// =====================================================

const isRoomMember = (
  room,
  userId
) => {
  if (
    !room ||
    !Array.isArray(room.members)
  ) {
    return false;
  }

  return room.members.some(
    (member) =>
      String(
        member?._id || member
      ) === String(userId)
  );
};

// =====================================================
// DISCOVER ROOMS
// GET /api/rooms/discover
// =====================================================

router.get(
  "/discover",
  authMiddleware,
  async (req, res) => {
    try {
      const userId =
        normalizeUserId(req.user.id);

      const rooms =
        await Room.find({})
          .populate(
            "creator",
            ROOM_USER_FIELDS
          )
          .populate(
            "members",
            ROOM_USER_FIELDS
          )
          .sort({
            createdAt: -1,
          })
          .lean();

      const result = rooms.map(
        (room) => ({
          ...room,

          description:
            room.description || "",

          isMember:
            isRoomMember(
              room,
              userId
            ),
        })
      );

      return res.status(200).json(result);
    } catch (error) {
      console.error(
        "[ROOM] Discover error:",
        error
      );

      return res.status(500).json({
        message:
          "Failed to load rooms.",
      });
    }
  }
);

// =====================================================
// JOIN ROOM BY CODE
// POST /api/rooms/join-by-code
// =====================================================

router.post(
  "/join-by-code",
  authMiddleware,
  async (req, res) => {
    try {
      const userId =
        normalizeUserId(req.user.id);

      const code =
        normalizeRoomCode(
          req.body?.code
        );

      if (!isValidRoomCode(code)) {
        return res.status(400).json({
          message:
            "Room code must contain exactly 6 letters or numbers.",
        });
      }

      const room =
        await Room.findOne({
          code,
        });

      if (!room) {
        return res.status(404).json({
          message:
            "Room not found. Check the room code and try again.",
        });
      }

      const roomId =
        String(room._id);

      const alreadyMember =
        room.members.some(
          (member) =>
            String(member) === userId
        );

      if (!alreadyMember) {
        room.members.push(userId);

        await room.save();

        console.log(
          `[ROOM] User ${userId} joined room ${roomId} using code ${code}`
        );
      }

      const populatedRoom =
        await getPopulatedRoom(
          room._id
        );

      if (!populatedRoom) {
        return res.status(500).json({
          message:
            "Failed to load joined room.",
        });
      }

      const io =
        req.app.get("io");

      if (io && !alreadyMember) {
        io.in(roomId).emit(
          "room_user_joined",
          {
            roomId,
            userId,
          }
        );
      }

      return res.status(200).json({
        message: alreadyMember
          ? "You are already a member of this room."
          : "Successfully joined room.",

        room: {
          ...populatedRoom,
          description:
            populatedRoom.description || "",
          isMember: true,
        },
      });
    } catch (error) {
      console.error(
        "[ROOM] Join-by-code error:",
        error
      );

      return res.status(500).json({
        message:
          "Failed to join room by code.",
      });
    }
  }
);

// =====================================================
// CREATE ROOM
// POST /api/rooms
// =====================================================

router.post(
  "/",
  authMiddleware,
  async (req, res) => {
    try {
      const userId =
        normalizeUserId(req.user.id);

      const name =
        normalizeText(
          req.body?.name
        );

      const description =
        normalizeText(
          req.body?.description
        );

      // -------------------------------------------------
      // VALIDATE NAME
      // -------------------------------------------------

      if (!name) {
        return res.status(400).json({
          message:
            "Room name is required.",
        });
      }

      if (
        name.length >
        ROOM_NAME_MAX_LENGTH
      ) {
        return res.status(400).json({
          message:
            `Room name cannot exceed ${ROOM_NAME_MAX_LENGTH} characters.`,
        });
      }

      // -------------------------------------------------
      // VALIDATE DESCRIPTION
      // -------------------------------------------------

      if (
        description.length >
        ROOM_DESCRIPTION_MAX_LENGTH
      ) {
        return res.status(400).json({
          message:
            `Room description cannot exceed ${ROOM_DESCRIPTION_MAX_LENGTH} characters.`,
        });
      }

      // -------------------------------------------------
      // CHECK DUPLICATE NAME
      // -------------------------------------------------

      const existingRoom =
        await Room.findOne({
          name,
        });

      if (existingRoom) {
        return res.status(409).json({
          message:
            "A room with this name already exists.",
        });
      }

      // -------------------------------------------------
      // GENERATE CODE
      // -------------------------------------------------

      const code =
        await generateUniqueRoomCode();

      // -------------------------------------------------
      // CREATE ROOM
      // -------------------------------------------------

      const room =
        await Room.create({
          name,
          description,
          code,
          creator: userId,
          members: [userId],
        });

      const populatedRoom =
        await getPopulatedRoom(
          room._id
        );

      if (!populatedRoom) {
        return res.status(500).json({
          message:
            "Room was created but could not be loaded.",
        });
      }

      return res.status(201).json({
        ...populatedRoom,

        description:
          populatedRoom.description || "",

        isMember: true,
      });
    } catch (error) {
      console.error(
        "[ROOM] Create error:",
        error
      );

      if (error?.code === 11000) {
        return res.status(409).json({
          message:
            "A room with this name or code already exists.",
        });
      }

      return res.status(500).json({
        message:
          error?.message ||
          "Failed to create room.",
      });
    }
  }
);

// =====================================================
// GET MY ROOMS
// GET /api/rooms
// =====================================================

router.get(
  "/",
  authMiddleware,
  async (req, res) => {
    try {
      const userId =
        normalizeUserId(req.user.id);

      const rooms =
        await Room.find({
          members: userId,
        })
          .populate(
            "creator",
            ROOM_USER_FIELDS
          )
          .populate(
            "members",
            ROOM_USER_FIELDS
          )
          .sort({
            createdAt: -1,
          })
          .lean();

      return res.status(200).json(
        rooms.map(
          (room) => ({
            ...room,

            description:
              room.description || "",

            isMember: true,
          })
        )
      );
    } catch (error) {
      console.error(
        "[ROOM] Get my rooms error:",
        error
      );

      return res.status(500).json({
        message:
          "Failed to load rooms.",
      });
    }
  }
);

// =====================================================
// JOIN ROOM BY ID
// POST /api/rooms/:roomId/join
// =====================================================

router.post(
  "/:roomId/join",
  authMiddleware,
  async (req, res) => {
    try {
      const { roomId } =
        req.params;

      const userId =
        normalizeUserId(req.user.id);

      if (
        !isValidObjectId(roomId)
      ) {
        return res.status(400).json({
          message:
            "Invalid room ID.",
        });
      }

      const room =
        await Room.findById(roomId);

      if (!room) {
        return res.status(404).json({
          message:
            "Room not found.",
        });
      }

      const alreadyMember =
        room.members.some(
          (member) =>
            String(member) === userId
        );

      if (!alreadyMember) {
        room.members.push(userId);

        await room.save();
      }

      const updatedRoom =
        await getPopulatedRoom(
          room._id
        );

      if (!updatedRoom) {
        return res.status(500).json({
          message:
            "Failed to load updated room.",
        });
      }

      const io =
        req.app.get("io");

      if (io && !alreadyMember) {
        io.in(
          String(room._id)
        ).emit(
          "room_user_joined",
          {
            roomId:
              String(room._id),
            userId,
          }
        );
      }

      return res.status(200).json({
        message: alreadyMember
          ? "You are already a member of this room."
          : "Successfully joined room.",

        room: {
          ...updatedRoom,

          description:
            updatedRoom.description || "",

          isMember: true,
        },
      });
    } catch (error) {
      console.error(
        "[ROOM] Join-by-id error:",
        error
      );

      return res.status(500).json({
        message:
          "Failed to join room.",
      });
    }
  }
);

// =====================================================
// ROOM MESSAGES
// GET /api/rooms/:roomId/messages
// =====================================================

router.get(
  "/:roomId/messages",
  authMiddleware,
  async (req, res) => {
    try {
      const { roomId } =
        req.params;

      const userId =
        normalizeUserId(req.user.id);

      if (
        !isValidObjectId(roomId)
      ) {
        return res.status(400).json({
          message:
            "Invalid room ID.",
        });
      }

      const room =
        await Room.findOne({
          _id: roomId,
          members: userId,
        })
          .select("_id")
          .lean();

      if (!room) {
        return res.status(403).json({
          message:
            "You are not a member of this room.",
        });
      }

      const user =
        await User.findById(userId)
          .select("language")
          .lean();

      const targetLanguage =
        user?.language || "English";

      const messages =
        await Message.find({
          roomId,
        })
          .populate(
            "sender",
            ROOM_USER_FIELDS
          )
          .sort({
            createdAt: 1,
          })
          .lean();

      const translatedMessages =
        await Promise.all(
          messages.map(async (message) => {
            if (
              message.messageType !== "text" ||
              !message.message
            ) {
              return message;
            }

            const translatedMessage =
              await translateText(
                message.message,
                message.originalLanguage || "English",
                targetLanguage
              );

            return {
              ...message,
              message: translatedMessage,
              originalMessage: message.message,
              translatedMessage,
              translatedLanguage:
                normalizeLanguageCode(targetLanguage),
            };
          })
        );

      return res
        .status(200)
        .json(translatedMessages);
    } catch (error) {
      console.error(
        "[ROOM] Get messages error:",
        error
      );

      return res.status(500).json({
        message:
          "Failed to load room messages.",
      });
    }
  }
);

// =====================================================
// GET ROOM
// GET /api/rooms/:roomId
// =====================================================

router.get(
  "/:roomId",
  authMiddleware,
  async (req, res) => {
    try {
      const { roomId } =
        req.params;

      const userId =
        normalizeUserId(req.user.id);

      if (
        !isValidObjectId(roomId)
      ) {
        return res.status(400).json({
          message:
            "Invalid room ID.",
        });
      }

      const room =
        await getPopulatedRoom(
          roomId
        );

      if (!room) {
        return res.status(404).json({
          message:
            "Room not found.",
        });
      }

      const isMember =
        isRoomMember(
          room,
          userId
        );

      if (!isMember) {
        return res.status(403).json({
          message:
            "You are not a member of this room.",
        });
      }

      return res.status(200).json({
        ...room,

        description:
          room.description || "",

        isMember: true,
      });
    } catch (error) {
      console.error(
        "[ROOM] Get room error:",
        error
      );

      return res.status(500).json({
        message:
          "Failed to load room.",
      });
    }
  }
);

// =====================================================
// UPDATE ROOM
// PATCH /api/rooms/:roomId
// =====================================================
//
// Only the room creator can edit:
//
// - name
// - description
//
// Body:
//
// {
//   "name": "New Room Name",
//   "description": "New description"
// }
//
// Both fields are optional, but at least one must be sent.
// =====================================================

router.patch(
  "/:roomId",
  authMiddleware,
  async (req, res) => {
    try {
      const { roomId } =
        req.params;

      const userId =
        normalizeUserId(req.user.id);

      if (
        !isValidObjectId(roomId)
      ) {
        return res.status(400).json({
          message:
            "Invalid room ID.",
        });
      }

      const room =
        await Room.findById(roomId);

      if (!room) {
        return res.status(404).json({
          message:
            "Room not found.",
        });
      }

      // -------------------------------------------------
      // CREATOR ONLY
      // -------------------------------------------------

      if (
        String(room.creator) !==
        userId
      ) {
        return res.status(403).json({
          message:
            "Only the room creator can edit the room.",
        });
      }

      const hasName =
        Object.prototype.hasOwnProperty.call(
          req.body || {},
          "name"
        );

      const hasDescription =
        Object.prototype.hasOwnProperty.call(
          req.body || {},
          "description"
        );

      if (
        !hasName &&
        !hasDescription
      ) {
        return res.status(400).json({
          message:
            "Provide a room name or description to update.",
        });
      }

      // -------------------------------------------------
      // NAME
      // -------------------------------------------------

      if (hasName) {
        const name =
          normalizeText(
            req.body.name
          );

        if (!name) {
          return res.status(400).json({
            message:
              "Room name cannot be empty.",
          });
        }

        if (
          name.length >
          ROOM_NAME_MAX_LENGTH
        ) {
          return res.status(400).json({
            message:
              `Room name cannot exceed ${ROOM_NAME_MAX_LENGTH} characters.`,
          });
        }

        // Check another room with same name.
        const duplicateRoom =
          await Room.findOne({
            name,
            _id: {
              $ne: roomId,
            },
          })
            .select("_id")
            .lean();

        if (duplicateRoom) {
          return res.status(409).json({
            message:
              "A room with this name already exists.",
          });
        }

        room.name = name;
      }

      // -------------------------------------------------
      // DESCRIPTION
      // -------------------------------------------------

      if (hasDescription) {
        const description =
          normalizeText(
            req.body.description
          );

        if (
          description.length >
          ROOM_DESCRIPTION_MAX_LENGTH
        ) {
          return res.status(400).json({
            message:
              `Room description cannot exceed ${ROOM_DESCRIPTION_MAX_LENGTH} characters.`,
          });
        }

        room.description =
          description;
      }

      // -------------------------------------------------
      // SAVE
      // -------------------------------------------------

      await room.save();

      const updatedRoom =
        await getPopulatedRoom(
          room._id
        );

      if (!updatedRoom) {
        return res.status(500).json({
          message:
            "Failed to load updated room.",
        });
      }

      const roomData = {
        ...updatedRoom,

        description:
          updatedRoom.description || "",

        isMember: true,
      };

      // -------------------------------------------------
      // REAL-TIME UPDATE
      // -------------------------------------------------

      const io =
        req.app.get("io");

      if (io) {
        io.in(
          String(room._id)
        ).emit(
          "room_updated",
          {
            room: roomData,
          }
        );
      }

      return res.status(200).json({
        message:
          "Room updated successfully.",

        room: roomData,
      });
    } catch (error) {
      console.error(
        "[ROOM] Update error:",
        error
      );

      if (error?.code === 11000) {
        return res.status(409).json({
          message:
            "A room with this name already exists.",
        });
      }

      return res.status(500).json({
        message:
          "Failed to update room.",
      });
    }
  }
);

// =====================================================
// LEAVE ROOM
// POST /api/rooms/:roomId/leave
// =====================================================

router.post(
  "/:roomId/leave",
  authMiddleware,
  async (req, res) => {
    try {
      const { roomId } =
        req.params;

      const userId =
        normalizeUserId(req.user.id);

      if (
        !isValidObjectId(roomId)
      ) {
        return res.status(400).json({
          message:
            "Invalid room ID.",
        });
      }

      const room =
        await Room.findById(roomId);

      if (!room) {
        return res.status(404).json({
          message:
            "Room not found.",
        });
      }

      const isMember =
        room.members.some(
          (member) =>
            String(member) === userId
        );

      if (!isMember) {
        return res.status(400).json({
          message:
            "You are not a member of this room.",
        });
      }

      if (
        String(room.creator) ===
        userId
      ) {
        return res.status(400).json({
          message:
            "Room creator cannot leave the room.",
        });
      }

      room.members =
        room.members.filter(
          (member) =>
            String(member) !== userId
        );

      await room.save();

      await ReadState.deleteOne({
        user: userId,
        scopeType: "room",
        target:
          String(room._id),
      });

      const io =
        req.app.get("io");

      const roomIdString =
        String(room._id);

      if (io) {
        const sockets =
          await io
            .in(roomIdString)
            .fetchSockets();

        for (
          const clientSocket of sockets
        ) {
          const clientUserId =
            String(
              clientSocket.userId
            );

          if (
            clientUserId === userId
          ) {
            clientSocket.emit(
              "room_left",
              {
                roomId:
                  roomIdString,
              }
            );

            await clientSocket.leave(
              roomIdString
            );
          } else {
            clientSocket.emit(
              "user_left_room",
              {
                roomId:
                  roomIdString,

                userId,
              }
            );
          }
        }
      }

      return res.status(200).json({
        message:
          "Successfully left room.",

        roomId:
          roomIdString,
      });
    } catch (error) {
      console.error(
        "[ROOM] Leave error:",
        error
      );

      return res.status(500).json({
        message:
          "Failed to leave room.",
      });
    }
  }
);

// =====================================================
// REMOVE MEMBER
// DELETE /api/rooms/:roomId/members/:memberId
// =====================================================

router.delete(
  "/:roomId/members/:memberId",
  authMiddleware,
  async (req, res) => {
    try {
      const {
        roomId,
        memberId,
      } = req.params;

      const userId =
        normalizeUserId(req.user.id);

      if (
        !isValidObjectId(roomId) ||
        !isValidObjectId(memberId)
      ) {
        return res.status(400).json({
          message:
            "Invalid room or member ID.",
        });
      }

      const room =
        await Room.findById(roomId);

      if (!room) {
        return res.status(404).json({
          message:
            "Room not found.",
        });
      }

      if (
        String(room.creator) !==
        userId
      ) {
        return res.status(403).json({
          message:
            "Only the room creator can remove members.",
        });
      }

      if (
        String(room.creator) ===
        String(memberId)
      ) {
        return res.status(400).json({
          message:
            "The room creator cannot be removed.",
        });
      }

      const isMember =
        room.members.some(
          (member) =>
            String(member) ===
            String(memberId)
        );

      if (!isMember) {
        return res.status(404).json({
          message:
            "User is not a member of this room.",
        });
      }

      room.members =
        room.members.filter(
          (member) =>
            String(member) !==
            String(memberId)
        );

      await room.save();

      await ReadState.deleteOne({
        user: memberId,
        scopeType: "room",
        target:
          String(room._id),
      });

      const updatedRoom =
        await getPopulatedRoom(
          room._id
        );

      if (!updatedRoom) {
        return res.status(500).json({
          message:
            "Failed to load updated room.",
        });
      }

      const io =
        req.app.get("io");

      const roomIdString =
        String(room._id);

      if (io) {
        const sockets =
          await io
            .in(roomIdString)
            .fetchSockets();

        for (
          const clientSocket of sockets
        ) {
          clientSocket.emit(
            "room_member_removed",
            {
              roomId:
                roomIdString,

              userId:
                String(memberId),
            }
          );

          if (
            String(
              clientSocket.userId
            ) ===
            String(memberId)
          ) {
            clientSocket.emit(
              "removed_from_room",
              {
                roomId:
                  roomIdString,

                roomName:
                  room.name,

                userId:
                  String(memberId),
              }
            );

            await clientSocket.leave(
              roomIdString
            );
          }
        }
      }

      return res.status(200).json({
        message:
          "Member removed successfully.",

        room: {
          ...updatedRoom,

          description:
            updatedRoom.description || "",

          isMember: true,
        },
      });
    } catch (error) {
      console.error(
        "[ROOM] Remove member error:",
        error
      );

      return res.status(500).json({
        message:
          "Failed to remove room member.",
      });
    }
  }
);

// =====================================================
// DELETE ROOM
// DELETE /api/rooms/:roomId
// =====================================================

router.delete(
  "/:roomId",
  authMiddleware,
  async (req, res) => {
    try {
      const { roomId } =
        req.params;

      const userId =
        normalizeUserId(req.user.id);

      if (
        !isValidObjectId(roomId)
      ) {
        return res.status(400).json({
          message:
            "Invalid room ID.",
        });
      }

      const room =
        await Room.findById(roomId);

      if (!room) {
        return res.status(404).json({
          message:
            "Room not found.",
        });
      }

      if (
        String(room.creator) !==
        userId
      ) {
        return res.status(403).json({
          message:
            "Only the room creator can delete the room.",
        });
      }

      const roomIdString =
        String(room._id);

      const roomName =
        room.name;

      const io =
        req.app.get("io");

      if (io) {
        const sockets =
          await io
            .in(roomIdString)
            .fetchSockets();

        for (
          const clientSocket of sockets
        ) {
          clientSocket.emit(
            "room_deleted",
            {
              roomId:
                roomIdString,

              roomName,
            }
          );

          await clientSocket.leave(
            roomIdString
          );
        }
      }

      await Message.deleteMany({
        roomId:
          roomIdString,
      });

      await ReadState.deleteMany({
        scopeType: "room",
        target:
          roomIdString,
      });

      await Room.deleteOne({
        _id:
          room._id,
      });

      return res.status(200).json({
        message:
          "Room deleted successfully.",

        roomId:
          roomIdString,
      });
    } catch (error) {
      console.error(
        "[ROOM] Delete error:",
        error
      );

      return res.status(500).json({
        message:
          "Failed to delete room.",
      });
    }
  }
);

// =====================================================
// EXPORT
// =====================================================

module.exports = router;