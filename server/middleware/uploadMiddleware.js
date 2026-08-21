const multer = require("multer");

// =====================================================
// STORAGE
// =====================================================

const storage =
  multer.memoryStorage();

// =====================================================
// ALLOWED IMAGE TYPES
// =====================================================

const allowedMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

// =====================================================
// FILE FILTER
// =====================================================

const fileFilter = (
  req,
  file,
  callback
) => {
  if (
    allowedMimeTypes.includes(
      file.mimetype
    )
  ) {
    return callback(
      null,
      true
    );
  }

  return callback(
    new Error(
      "Only JPEG, PNG, WEBP and GIF images are allowed."
    )
  );
};

// =====================================================
// PROFILE PICTURE UPLOAD
// =====================================================

const uploadProfilePicture =
  multer({
    storage,

    limits: {
      fileSize:
        5 * 1024 * 1024,
    },

    fileFilter,
  });

module.exports =
  uploadProfilePicture;