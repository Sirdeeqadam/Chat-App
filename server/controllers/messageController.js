const Message = require("../models/Message");
const mongoose = require("mongoose");
const User = require("../models/User");
const {
  normalizeLanguageCode,
  translateText,
} = require("../services/translationService");


// ==========================================
// GET PRIVATE MESSAGES
// ==========================================
exports.getPrivateMessages = async (req, res) => {
  try {

    // ========================================
    // CHECK AUTHENTICATION
    // ========================================

    if (!req.user || !req.user.id) {
      return res.status(401).json({
        message: "Authentication required"
      });
    }


    // ========================================
    // GET AUTHENTICATED USER
    // ========================================

    const authenticatedUserId =
      String(req.user.id);

    const { otherUserId } =
      req.params;


    // ========================================
    // VALIDATE OTHER USER ID
    // ========================================

    if (
      !mongoose.Types.ObjectId.isValid(
        otherUserId
      )
    ) {
      return res.status(400).json({
        message: "Invalid user ID"
      });
    }


    // ========================================
    // PREVENT USER FROM TALKING TO THEMSELVES
    // ========================================

    if (
      authenticatedUserId ===
      String(otherUserId)
    ) {
      return res.status(400).json({
        message:
          "You cannot access a conversation with yourself"
      });
    }


    // ========================================
    // GET ONLY AUTHORIZED CONVERSATION
    // ========================================

    const authenticatedUser =
      await User.findById(authenticatedUserId)
        .select("language")
        .lean();

    const targetLanguage =
      authenticatedUser?.language || "English";

    const messages =
      await Message.find({
        $or: [

          {
            sender:
              authenticatedUserId,

            receiver:
              otherUserId
          },

          {
            sender:
              otherUserId,

            receiver:
              authenticatedUserId
          }

        ]
      })
      .sort({
        createdAt: 1
      })
      .lean();

    const translatedMessages =
      await Promise.all(
        messages.map(async (message) => {
          const isIncoming =
            String(message.sender) !==
            authenticatedUserId;

          if (
            !isIncoming ||
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
            translatedMessage,
            translatedLanguage:
              normalizeLanguageCode(targetLanguage),
          };
        })
      );


    // ========================================
    // RETURN MESSAGES
    // ========================================

    return res.status(200).json(
      translatedMessages
    );

  } catch (error) {

    console.error(
      "Get private messages error:",
      error
    );

    return res.status(500).json({
      message:
        "Failed to retrieve messages"
    });

  }
};