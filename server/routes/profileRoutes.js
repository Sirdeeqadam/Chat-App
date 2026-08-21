const express = require("express");
const fs = require("fs");
const path = require("path");

const User = require("../models/User");

const authMiddleware =
  require("../middleware/authMiddleware");

const uploadProfilePicture =
  require("../middleware/uploadMiddleware");

const router = express.Router();

// =====================================================
// UPLOAD DIRECTORY
// =====================================================

const profileUploadDirectory = path.join(
  __dirname,
  "..",
  "uploads",
  "profiles"
);

if (!fs.existsSync(profileUploadDirectory)) {
  fs.mkdirSync(profileUploadDirectory, {
    recursive: true,
  });
}

// =====================================================
// USER SELECT
// =====================================================

const USER_SELECT =
  "_id username email language bio profilePicture createdAt updatedAt";

// =====================================================
// BUILD PUBLIC USER
// =====================================================

const buildPublicUser = (user) => {
  if (!user) {
    return null;
  }

  return {
    _id: String(user._id),

    id: String(user._id),

    username: user.username,

    email: user.email,

    language: user.language || "English",

    bio: user.bio || "",

    profilePicture:
      user.profilePicture || null,

    createdAt: user.createdAt,

    updatedAt: user.updatedAt,
  };
};

// =====================================================
// BROADCAST PROFILE UPDATE
// =====================================================
//
// This is the ONLY REST-side profile broadcast.
//
// Every connected client receives:
//
// profile_updated
//
// Payload:
//
// {
//   userId,
//   user
// }
//
// This allows the frontend to update the user's avatar,
// username, language and bio everywhere immediately.
// =====================================================

const broadcastProfileUpdate = (
  req,
  user
) => {
  try {
    if (!user) {
      return;
    }

    const io = req.app.get("io");

    if (!io) {
      console.warn(
        "[PROFILE] Socket.IO instance not available."
      );

      return;
    }

    const publicUser =
      buildPublicUser(user);

    const userId =
      String(user._id);

    io.emit(
      "profile_updated",
      {
        userId,
        user: publicUser,
      }
    );

    console.log(
      `[PROFILE] profile_updated broadcast: ${userId}`
    );
  } catch (error) {
    console.error(
      "[PROFILE] Broadcast error:",
      error
    );
  }
};

// =====================================================
// GET MY PROFILE
// GET /api/profile
// =====================================================

router.get(
  "/",
  authMiddleware,
  async (req, res) => {
    try {
      const user =
        await User.findById(
          req.user.id
        ).select(USER_SELECT);

      if (!user) {
        return res.status(404).json({
          message:
            "User not found.",
        });
      }

      return res.status(200).json(
        buildPublicUser(user)
      );
    } catch (error) {
      console.error(
        "[PROFILE] Get profile error:",
        error
      );

      return res.status(500).json({
        message:
          "Failed to load profile.",
      });
    }
  }
);

// =====================================================
// UPDATE PROFILE
// PUT /api/profile
// =====================================================

router.put(
  "/",
  authMiddleware,
  async (req, res) => {
    try {
      const {
        username,
        language,
        bio,
      } = req.body || {};

      const user =
        await User.findById(
          req.user.id
        );

      if (!user) {
        return res.status(404).json({
          message:
            "User not found.",
        });
      }

      // =================================================
      // USERNAME
      // =================================================

      if (
        username !== undefined
      ) {
        const cleanedUsername =
          String(username).trim();

        if (
          cleanedUsername.length < 3
        ) {
          return res.status(400).json({
            message:
              "Username must be at least 3 characters.",
          });
        }

        if (
          cleanedUsername.length > 30
        ) {
          return res.status(400).json({
            message:
              "Username cannot exceed 30 characters.",
          });
        }

        const existingUser =
          await User.findOne({
            username:
              cleanedUsername,

            _id: {
              $ne:
                req.user.id,
            },
          }).select("_id");

        if (existingUser) {
          return res.status(409).json({
            message:
              "Username is already taken.",
          });
        }

        user.username =
          cleanedUsername;
      }

      // =================================================
      // LANGUAGE
      // =================================================

      if (
        language !== undefined
      ) {
        const allowedLanguages = [
          "English",
          "Hausa",
          "French",
          "Arabic",
        ];

        if (
          !allowedLanguages.includes(
            language
          )
        ) {
          return res.status(400).json({
            message:
              "Unsupported language.",
          });
        }

        user.language =
          language;
      }

      // =================================================
      // BIO
      // =================================================

      if (
        bio !== undefined
      ) {
        const cleanedBio =
          String(bio).trim();

        if (
          cleanedBio.length > 160
        ) {
          return res.status(400).json({
            message:
              "Bio cannot exceed 160 characters.",
          });
        }

        user.bio =
          cleanedBio;
      }

      // =================================================
      // SAVE
      // =================================================

      await user.save();

      const updatedUser =
        await User.findById(
          user._id
        ).select(USER_SELECT);

      if (!updatedUser) {
        return res.status(404).json({
          message:
            "User not found after update.",
        });
      }

      // =================================================
      // REAL-TIME BROADCAST
      // =================================================

      broadcastProfileUpdate(
        req,
        updatedUser
      );

      return res.status(200).json({
        message:
          "Profile updated successfully.",

        user:
          buildPublicUser(
            updatedUser
          ),
      });
    } catch (error) {
      console.error(
        "[PROFILE] Update profile error:",
        error
      );

      if (
        error?.code === 11000
      ) {
        return res.status(409).json({
          message:
            "Username or email is already in use.",
        });
      }

      return res.status(500).json({
        message:
          "Failed to update profile.",
      });
    }
  }
);

// =====================================================
// UPLOAD PROFILE PICTURE
// POST /api/profile/picture
// =====================================================

router.post(
  "/picture",
  authMiddleware,
  uploadProfilePicture.single(
    "profilePicture"
  ),
  async (req, res) => {
    let savedFilePath = null;

    try {
      if (!req.file) {
        return res.status(400).json({
          message:
            "Please select an image.",
        });
      }

      const user =
        await User.findById(
          req.user.id
        );

      if (!user) {
        return res.status(404).json({
          message:
            "User not found.",
        });
      }

      // =================================================
      // ALLOWED IMAGE TYPES
      // =================================================

      const extensionMap = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "image/gif": "gif",
      };

      const extension =
        extensionMap[
          req.file.mimetype
        ];

      if (!extension) {
        return res.status(400).json({
          message:
            "Unsupported image type.",
        });
      }

      // =================================================
      // CREATE UNIQUE FILE NAME
      // =================================================

      const filename =
        `${user._id}-${Date.now()}.${extension}`;

      savedFilePath =
        path.join(
          profileUploadDirectory,
          filename
        );

      // =================================================
      // SAVE IMAGE
      // =================================================

      fs.writeFileSync(
        savedFilePath,
        req.file.buffer
      );

      const oldPicture =
        user.profilePicture;

      user.profilePicture =
        `/uploads/profiles/${filename}`;

      await user.save();

      // =================================================
      // DELETE OLD IMAGE
      // =================================================

      if (
        oldPicture &&
        oldPicture.startsWith(
          "/uploads/profiles/"
        )
      ) {
        const oldFilePath =
          path.join(
            __dirname,
            "..",
            oldPicture
          );

        if (
          fs.existsSync(oldFilePath)
        ) {
          try {
            fs.unlinkSync(
              oldFilePath
            );
          } catch (deleteError) {
            console.error(
              "[PROFILE] Failed to delete old profile image:",
              deleteError
            );
          }
        }
      }

      // =================================================
      // LOAD UPDATED USER
      // =================================================

      const updatedUser =
        await User.findById(
          user._id
        ).select(USER_SELECT);

      if (!updatedUser) {
        return res.status(404).json({
          message:
            "User not found after upload.",
        });
      }

      // =================================================
      // REAL-TIME BROADCAST
      // =================================================

      broadcastProfileUpdate(
        req,
        updatedUser
      );

      return res.status(200).json({
        message:
          "Profile picture updated successfully.",

        profilePicture:
          updatedUser.profilePicture,

        user:
          buildPublicUser(
            updatedUser
          ),
      });
    } catch (error) {
      console.error(
        "[PROFILE] Upload profile picture error:",
        error
      );

      // Remove newly saved file if the
      // database update failed.
      if (
        savedFilePath &&
        fs.existsSync(savedFilePath)
      ) {
        try {
          fs.unlinkSync(
            savedFilePath
          );
        } catch (cleanupError) {
          console.error(
            "[PROFILE] Failed to clean up uploaded file:",
            cleanupError
          );
        }
      }

      return res.status(500).json({
        message:
          error?.message ||
          "Failed to upload profile picture.",
      });
    }
  }
);

// =====================================================
// REMOVE PROFILE PICTURE
// DELETE /api/profile/picture
// =====================================================

router.delete(
  "/picture",
  authMiddleware,
  async (req, res) => {
    try {
      const user =
        await User.findById(
          req.user.id
        );

      if (!user) {
        return res.status(404).json({
          message:
            "User not found.",
        });
      }

      const oldPicture =
        user.profilePicture;

      user.profilePicture =
        null;

      await user.save();

      // =================================================
      // DELETE OLD IMAGE
      // =================================================

      if (
        oldPicture &&
        oldPicture.startsWith(
          "/uploads/profiles/"
        )
      ) {
        const filePath =
          path.join(
            __dirname,
            "..",
            oldPicture
          );

        if (
          fs.existsSync(filePath)
        ) {
          try {
            fs.unlinkSync(
              filePath
            );
          } catch (deleteError) {
            console.error(
              "[PROFILE] Failed to delete profile image:",
              deleteError
            );
          }
        }
      }

      // =================================================
      // LOAD UPDATED USER
      // =================================================

      const updatedUser =
        await User.findById(
          user._id
        ).select(USER_SELECT);

      if (!updatedUser) {
        return res.status(404).json({
          message:
            "User not found after removal.",
        });
      }

      // =================================================
      // REAL-TIME BROADCAST
      // =================================================

      broadcastProfileUpdate(
        req,
        updatedUser
      );

      return res.status(200).json({
        message:
          "Profile picture removed successfully.",

        user:
          buildPublicUser(
            updatedUser
          ),
      });
    } catch (error) {
      console.error(
        "[PROFILE] Remove profile picture error:",
        error
      );

      return res.status(500).json({
        message:
          "Failed to remove profile picture.",
      });
    }
  }
);

module.exports = router;