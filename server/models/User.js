const mongoose = require("mongoose");

// =========================================================
// USER SCHEMA
// =========================================================

const userSchema = new mongoose.Schema(
  {
    // =====================================================
    // USERNAME
    // =====================================================

    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
    },

    // =====================================================
    // EMAIL
    // =====================================================

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },

    // =====================================================
    // PASSWORD
    // =====================================================
    //
    // IMPORTANT:
    // Never send this field to the frontend.
    //
    // Your socket USER_FIELDS already excludes it.
    // =====================================================

    password: {
      type: String,
      required: true,
      minlength: 6,
    },

    passwordResetTokenHash: {
      type: String,
      default: null,
      select: false,
    },

    passwordResetExpiresAt: {
      type: Date,
      default: null,
      select: false,
    },

    passwordResetOtpHash: {
      type: String,
      default: null,
      select: false,
    },

    // =====================================================
    // LANGUAGE
    // =====================================================

    language: {
      type: String,
      enum: [
        "English",
        "Hausa",
        "French",
        "Arabic",
      ],
      default: "English",
      index: true,
    },

    // =====================================================
    // PROFILE PICTURE
    // =====================================================

    profilePicture: {
      type: String,
      default: null,
      trim: true,
    },

    // =====================================================
    // BIO
    // =====================================================

    bio: {
      type: String,
      default: "",
      trim: true,
      maxlength: 160,
    },
  },
  {
    timestamps: true,
  }
);

// =========================================================
// MODEL
// =========================================================

module.exports = mongoose.model(
  "User",
  userSchema
);