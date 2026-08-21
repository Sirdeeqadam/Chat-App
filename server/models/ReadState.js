const mongoose = require("mongoose");

// =========================================================
// READ STATE SCHEMA
// =========================================================
//
// Stores the last point a user has read.
//
// Private:
//
// user      = current user
// scopeType = "private"
// target    = other user's ObjectId
//
// Room:
//
// user      = current user
// scopeType = "room"
// target    = room's ObjectId
// =========================================================

const readStateSchema = new mongoose.Schema(
  {
    // =====================================================
    // USER
    // =====================================================

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // =====================================================
    // SCOPE TYPE
    // =====================================================

    scopeType: {
      type: String,
      enum: ["private", "room"],
      required: true,
      index: true,
    },

    // =====================================================
    // TARGET
    //
    // private -> User ObjectId
    // room    -> Room ObjectId
    // =====================================================

    target: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    // =====================================================
    // LAST READ TIME
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
// UNIQUE READ POSITION
// =========================================================
//
// One user can have only one read state for:
//
// user + private + otherUser
//
// OR:
//
// user + room + room
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
// FAST LOOKUP
// =========================================================

readStateSchema.index({
  user: 1,
  scopeType: 1,
});

// =========================================================
// VALIDATE TARGET
// =========================================================
//
// This verifies that target is a valid ObjectId.
// It does not verify whether it belongs to User or Room;
// that depends on scopeType.
// =========================================================

readStateSchema.pre(
  "validate",
  function (next) {
    if (
      !mongoose.Types.ObjectId.isValid(
        this.target
      )
    ) {
      return next(
        new Error(
          "Invalid read state target."
        )
      );
    }

    if (!this.scopeType) {
      return next(
        new Error(
          "Read state scopeType is required."
        )
      );
    }

    next();
  }
);

// =========================================================
// MODEL
// =========================================================

module.exports = mongoose.model(
  "ReadState",
  readStateSchema
);