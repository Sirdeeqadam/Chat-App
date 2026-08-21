const Room = require("../models/Room");

// ==========================================
// CREATE ROOM
// ==========================================

const createRoom = async (req, res) => {
  try {
    const {
      name,
      description
    } = req.body;

    // ----------------------------------------
    // VALIDATE ROOM NAME
    // ----------------------------------------

    if (!name || !name.trim()) {
      return res.status(400).json({
        message: "Room name is required"
      });
    }

    // ----------------------------------------
    // VALIDATE DESCRIPTION
    // ----------------------------------------

    if (
      description !== undefined &&
      description !== null &&
      typeof description !== "string"
    ) {
      return res.status(400).json({
        message: "Room description must be a string"
      });
    }

    const cleanName =
      name.trim();

    const cleanDescription =
      typeof description === "string"
        ? description.trim()
        : "";

    // ----------------------------------------
    // CREATE ROOM
    // ----------------------------------------

    const room = await Room.create({
      name: cleanName,

      description:
        cleanDescription,

      creator:
        req.user.id,

      members: [
        req.user.id
      ]
    });

    // ----------------------------------------
    // POPULATE ROOM
    // ----------------------------------------

    const populatedRoom =
      await Room.findById(
        room._id
      )
        .populate(
          "creator",
          "username email"
        )
        .populate(
          "members",
          "username email"
        );

    // ----------------------------------------
    // RESPONSE
    // ----------------------------------------

    res.status(201).json({
      message:
        "Room created successfully",

      room:
        populatedRoom
    });
  } catch (error) {
    console.error(
      "Create room error:",
      error
    );

    res.status(500).json({
      message:
        "Failed to create room"
    });
  }
};

// ==========================================
// GET ALL ROOMS
// ==========================================

const getRooms = async (req, res) => {
  try {
    const rooms =
      await Room.find()
        .populate(
          "creator",
          "username email"
        )
        .populate(
          "members",
          "username email"
        )
        .sort({
          createdAt: -1
        });

    res.status(200).json({
      rooms
    });
  } catch (error) {
    console.error(
      "Get rooms error:",
      error
    );

    res.status(500).json({
      message:
        "Failed to get rooms"
    });
  }
};

// ==========================================
// JOIN ROOM
// ==========================================

const joinRoom = async (req, res) => {
  try {
    const {
      roomId
    } = req.params;

    const room =
      await Room.findById(
        roomId
      );

    if (!room) {
      return res.status(404).json({
        message:
          "Room not found"
      });
    }

    // ----------------------------------------
    // CHECK MEMBERSHIP
    // ----------------------------------------

    const alreadyMember =
      room.members.some(
        (member) =>
          String(member) ===
          String(req.user.id)
      );

    if (alreadyMember) {
      return res.status(400).json({
        message:
          "You are already a member of this room"
      });
    }

    // ----------------------------------------
    // ADD MEMBER
    // ----------------------------------------

    room.members.push(
      req.user.id
    );

    await room.save();

    // ----------------------------------------
    // POPULATE ROOM
    // ----------------------------------------

    const populatedRoom =
      await Room.findById(
        room._id
      )
        .populate(
          "creator",
          "username email"
        )
        .populate(
          "members",
          "username email"
        );

    res.status(200).json({
      message:
        "Joined room successfully",

      room:
        populatedRoom
    });
  } catch (error) {
    console.error(
      "Join room error:",
      error
    );

    res.status(500).json({
      message:
        "Failed to join room"
    });
  }
};

// ==========================================
// LEAVE ROOM
// ==========================================

const leaveRoom = async (req, res) => {
  try {
    const {
      roomId
    } = req.params;

    const room =
      await Room.findById(
        roomId
      );

    if (!room) {
      return res.status(404).json({
        message:
          "Room not found"
      });
    }

    // ----------------------------------------
    // CREATOR CANNOT LEAVE
    // ----------------------------------------

    if (
      String(room.creator) ===
      String(req.user.id)
    ) {
      return res.status(400).json({
        message:
          "Room creator cannot leave the room"
      });
    }

    // ----------------------------------------
    // REMOVE MEMBER
    // ----------------------------------------

    room.members =
      room.members.filter(
        (member) =>
          String(member) !==
          String(req.user.id)
      );

    await room.save();

    res.status(200).json({
      message:
        "Left room successfully"
    });
  } catch (error) {
    console.error(
      "Leave room error:",
      error
    );

    res.status(500).json({
      message:
        "Failed to leave room"
    });
  }
};

// ==========================================
// UPDATE ROOM DESCRIPTION
// ==========================================
//
// Only the room creator can update the
// description.
//
// PATCH /api/rooms/:roomId/description
// ==========================================

const updateRoomDescription = async (
  req,
  res
) => {
  try {
    const {
      roomId
    } = req.params;

    const {
      description
    } = req.body;

    // ----------------------------------------
    // VALIDATE ROOM ID
    // ----------------------------------------

    if (
      !roomId ||
      !require("mongoose")
        .Types.ObjectId.isValid(
          roomId
        )
    ) {
      return res.status(400).json({
        message:
          "Invalid room ID"
      });
    }

    // ----------------------------------------
    // VALIDATE DESCRIPTION
    // ----------------------------------------

    if (
      description !== undefined &&
      description !== null &&
      typeof description !== "string"
    ) {
      return res.status(400).json({
        message:
          "Room description must be a string"
      });
    }

    const cleanDescription =
      typeof description === "string"
        ? description.trim()
        : "";

    if (
      cleanDescription.length >
      500
    ) {
      return res.status(400).json({
        message:
          "Room description cannot exceed 500 characters"
      });
    }

    // ----------------------------------------
    // FIND ROOM
    // ----------------------------------------

    const room =
      await Room.findById(
        roomId
      );

    if (!room) {
      return res.status(404).json({
        message:
          "Room not found"
      });
    }

    // ----------------------------------------
    // ONLY CREATOR CAN UPDATE
    // ----------------------------------------

    if (
      String(room.creator) !==
      String(req.user.id)
    ) {
      return res.status(403).json({
        message:
          "Only the room creator can update the room description"
      });
    }

    // ----------------------------------------
    // UPDATE
    // ----------------------------------------

    room.description =
      cleanDescription;

    await room.save();

    // ----------------------------------------
    // POPULATE
    // ----------------------------------------

    const populatedRoom =
      await Room.findById(
        room._id
      )
        .populate(
          "creator",
          "username email"
        )
        .populate(
          "members",
          "username email"
        );

    res.status(200).json({
      message:
        "Room description updated successfully",

      room:
        populatedRoom
    });
  } catch (error) {
    console.error(
      "Update room description error:",
      error
    );

    res.status(500).json({
      message:
        "Failed to update room description"
    });
  }
};

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
  createRoom,
  getRooms,
  joinRoom,
  leaveRoom,
  updateRoomDescription
};