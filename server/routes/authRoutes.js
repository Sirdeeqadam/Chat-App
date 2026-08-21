const express = require("express");

const router = express.Router();

const {
  registerUser,
  loginUser,
  requestPasswordReset,
  resetPassword,
  getUsers,
  updateLanguage,
} = require("../controllers/authController");

const authMiddleware =
  require("../middleware/authMiddleware");

// =====================================================
// AUTH
// =====================================================

router.post(
  "/register",
  registerUser
);

router.post(
  "/login",
  loginUser
);

router.post(
  "/forgot-password",
  requestPasswordReset
);

router.post(
  "/reset-password",
  resetPassword
);

// =====================================================
// USERS
// =====================================================

router.get(
  "/users",
  getUsers
);

// =====================================================
// LANGUAGE
// =====================================================

router.put(
  "/language",
  authMiddleware,
  updateLanguage
);

module.exports = router;