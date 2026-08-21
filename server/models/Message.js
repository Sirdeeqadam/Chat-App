const mongoose = require("mongoose");

// =========================================================
// MESSAGE SCHEMA
// =========================================================

const messageSchema = new mongoose.Schema(
  {
    // =======================================================
    // SENDER
    // =======================================================

    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // =======================================================
    // PRIVATE MESSAGE RECEIVER
    //
    // Required for private messages.
    // null for room messages.
    // =======================================================

    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    // =======================================================
    // ROOM
    //
    // null  = private message
    // ObjectId string = room message
    // =======================================================

    roomId: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },

    // =======================================================
    // MESSAGE CONTENT
    // =======================================================

    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 10000,
    },

    attachmentUrl: {
      type: String,
      default: null,
      trim: true,
    },

    attachmentName: {
      type: String,
      default: null,
      trim: true,
      maxlength: 255,
    },

    attachmentMimeType: {
      type: String,
      default: null,
      trim: true,
      maxlength: 100,
    },

    // =======================================================
    // ORIGINAL LANGUAGE
    // =======================================================

    originalLanguage: {
      type: String,
      enum: ["en", "ha", "fr", "ar"],
      default: "en",
      lowercase: true,
      trim: true,
      required: true,
    },

    // =======================================================
    // TRANSLATED MESSAGE
    //
    // Used for private messages when the receiver has a
    // different language.
    //
    // Room translations are generated dynamically for each
    // connected user and are NOT stored here.
    // =======================================================

    translatedMessage: {
      type: String,
      default: null,
      trim: true,
      maxlength: 10000,
    },

    // =======================================================
    // TRANSLATED LANGUAGE
    // =======================================================

    translatedLanguage: {
      type: String,
      enum: ["en", "ha", "fr", "ar", null],
      default: null,
      lowercase: true,
      trim: true,
    },

    // =======================================================
    // MESSAGE TYPE
    // =======================================================

    messageType: {
      type: String,
      enum: ["text", "audio", "image", "video", "file"],
      default: "text",
      index: true,
    },

    // =======================================================
    // DELIVERY STATUS
    // =======================================================

    deliveryStatus: {
      type: String,
      enum: ["sent", "delivered", "read"],
      default: "sent",
      index: true,
    },

    // =======================================================
    // READ TIME
    // =======================================================

    readAt: {
      type: Date,
      default: null,
    },
  },

  {
    timestamps: true,
  }
);

// =========================================================
// INDEXES
// =========================================================

// Private conversation
messageSchema.index({
  sender: 1,
  receiver: 1,
  createdAt: 1,
});

messageSchema.index({
  receiver: 1,
  sender: 1,
  createdAt: 1,
});

// Unread private messages
messageSchema.index({
  receiver: 1,
  deliveryStatus: 1,
  createdAt: 1,
});

// Room messages
messageSchema.index({
  roomId: 1,
  createdAt: 1,
});

// Room messages by sender
messageSchema.index({
  roomId: 1,
  sender: 1,
  createdAt: 1,
});

// =========================================================
// MODEL
// =========================================================

module.exports =
  mongoose.models.Message ||
  mongoose.model(
    "Message",
    messageSchema
  );