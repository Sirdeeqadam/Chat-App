const mongoose = require("mongoose");

const readStateSchema =
  new mongoose.Schema(
    {
      // =====================================================
      // USER WHOSE READ POSITION THIS REPRESENTS
      // =====================================================

      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
      },

      // =====================================================
      // READ STATE TYPE
      // =====================================================

      scopeType: {
        type: String,
        enum: [
          "private",
          "room",
        ],
        required: true,
      },

      // =====================================================
      // TARGET
      //
      // private -> other user's ObjectId
      // room    -> room's ObjectId
      // =====================================================

      target: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
      },

      // =====================================================
      // LAST MESSAGE TIME THE USER HAS READ
      // =====================================================

      lastReadAt: {
        type: Date,
        default: null,
      },
    },
    {
      timestamps: true,
    }
  );

// =========================================================
// UNIQUE READ STATE
//
// One user can have only one read position for:
//   user + private + otherUser
//   user + room    + room
// =========================================================

readStateSchema.index(
  {
    user: 1,
    scopeType: 1,
    target: 1,
  },
  {
    unique: true,
  }
);

// =========================================================
// FAST ROOM/PRIVATE LOOKUPS
// =========================================================

readStateSchema.index({
  user: 1,
  scopeType: 1,
});

readStateSchema.index({
  target: 1,
  scopeType: 1,
});

module.exports =
  mongoose.model(
    "ReadState",
    readStateSchema
  );