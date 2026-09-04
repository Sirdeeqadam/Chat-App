const express = require("express");
const router = express.Router();

const {
  registerUser,
  loginUser,
  verifyEmail,
  resendVerificationOtp,
  requestPasswordReset,
  resetPassword,
  getUsers,
  updateLanguage,
} = require("../controllers/authController");

const authMiddleware = require("../middleware/authMiddleware");

// =====================================================
// AUTH & VERIFICATION
// =====================================================

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/verify-email", verifyEmail);
router.post("/resend-otp", resendVerificationOtp);
router.post("/forgot-password", requestPasswordReset);
router.post("/reset-password", resetPassword);

// =====================================================
// USERS
// =====================================================

router.get("/users", getUsers);

// =====================================================
// LANGUAGE
// =====================================================

router.put("/language", authMiddleware, updateLanguage);

module.exports = router;