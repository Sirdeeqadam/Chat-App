const mongoose = require("mongoose");

// =========================================================
// ROOM SCHEMA
// =========================================================

const roomSchema = new mongoose.Schema(
  {
    // =====================================================
    // ROOM NAME
    // =====================================================

    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 50,
    },

    // =====================================================
    // ROOM DESCRIPTION
    // =====================================================
    //
    // Optional description explaining what the room is about.
    //
    // Example:
    // "A community for Computer Science students."
    //
    // Empty descriptions are stored as "".
    // =====================================================

    description: {
      type: String,
      trim: true,
      default: "",
      maxlength: 500,
    },

    // =====================================================
    // ROOM CODE
    //
    // Example:
    // ABC123
    // =====================================================

    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      minlength: 6,
      maxlength: 6,
      match: /^[A-Z0-9]{6}$/,
      index: true,
    },

    // =====================================================
    // ROOM CREATOR
    // =====================================================

    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // =====================================================
    // ROOM MEMBERS
    // =====================================================

    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  {
    timestamps: true,
  }
);

// =========================================================
// INDEXES
// =========================================================

// Find rooms where a user is a member.
roomSchema.index({
  members: 1,
});

// =========================================================
// PREVENT DUPLICATE MEMBERS
// =========================================================
//
// Ensures the same user cannot appear more than once
// in the members array.
//
// Example:
//
// members: [user1, user1, user2]
//
// becomes:
//
// members: [user1, user2]
// =========================================================

roomSchema.pre(
  "validate",
  function () {
    if (
      !Array.isArray(
        this.members
      )
    ) {
      this.members = [];
      return;
    }

    const uniqueMembers = [
      ...new Set(
        this.members.map(
          (member) =>
            String(member)
        )
      ),
    ];

    this.members =
      uniqueMembers.map(
        (member) =>
          new mongoose.Types.ObjectId(
            member
          )
      );
  }
);

// =========================================================
// MODEL
// =========================================================

module.exports = mongoose.model(
  "Room",
  roomSchema
);