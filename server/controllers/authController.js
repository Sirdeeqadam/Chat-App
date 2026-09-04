const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const {
  hasSmtpConfig,
  sendPasswordResetOtp,
} = require("../services/emailService");

// =====================================================
// CONSTANTS
// =====================================================

const ALLOWED_LANGUAGES = ["English", "Hausa", "French", "Arabic"];
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1d";
const USER_SELECT_FIELDS = "_id username email language bio profilePicture createdAt updatedAt";
const PASSWORD_RESET_MINUTES = 30;

// =====================================================
// HELPERS
// =====================================================

const createSafeUser = (user) => ({
  _id: user?._id,
  id: user?._id ? String(user._id) : user?.id,
  username: user?.username || "",
  email: user?.email || "",
  language: user?.language || "English",
  bio: user?.bio || "",
  profilePicture: user?.profilePicture || null,
  createdAt: user?.createdAt,
  updatedAt: user?.updatedAt,
});

// =====================================================
// REGISTER USER
// POST /api/auth/register
// =====================================================

exports.registerUser = async (req, res) => {
  try {
    const { username, email, password, language } = req.body || {};

    if (typeof username !== "string" || !username.trim()) {
      return res.status(400).json({ message: "Username is required." });
    }

    const normalizedUsername = username.trim();

    if (normalizedUsername.length < 3) {
      return res.status(400).json({ message: "Username must be at least 3 characters." });
    }

    if (normalizedUsername.length > 30) {
      return res.status(400).json({ message: "Username cannot exceed 30 characters." });
    }

    if (typeof email !== "string" || !email.trim()) {
      return res.status(400).json({ message: "Email is required." });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (typeof password !== "string" || !password.trim()) {
      return res.status(400).json({ message: "Password is required." });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters." });
    }

    const selectedLanguage = language || "English";

    if (!ALLOWED_LANGUAGES.includes(selectedLanguage)) {
      return res.status(400).json({ message: "Unsupported language." });
    }

    const existingEmailUser = await User.findOne({ email: normalizedEmail });
    if (existingEmailUser) {
      return res.status(409).json({ message: "Email is already registered." });
    }

    const existingUsernameUser = await User.findOne({
      username: { $regex: new RegExp(`^${normalizedUsername}$`, "i") },
    });
    if (existingUsernameUser) {
      return res.status(409).json({ message: "Username is already taken." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      username: normalizedUsername,
      email: normalizedEmail,
      password: hashedPassword,
      language: selectedLanguage,
      bio: "",
      profilePicture: null,
    });

    await newUser.save();

    return res.status(201).json({ message: "User registered successfully." });
  } catch (error) {
    console.error("Registration error:", error);

    if (error?.code === 11000) {
      const duplicateField = Object.keys(error.keyPattern || {})[0];
      return res.status(409).json({
        message:
          duplicateField === "username"
            ? "Username is already taken."
            : "Email is already registered.",
      });
    }

    return res.status(500).json({ message: "Server error during registration." });
  }
};

// =====================================================
// LOGIN USER
// POST /api/auth/login
// =====================================================

exports.loginUser = async (req, res) => {
  try {
    const { email, username, identifier, password } = req.body || {};

    if (typeof password !== "string" || !password.trim()) {
      return res.status(400).json({ message: "Password is required." });
    }

    const loginIdentifier = (identifier || email || username || "").trim();

    if (!loginIdentifier) {
      return res.status(400).json({ message: "Email or username is required." });
    }

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is missing");
      return res.status(500).json({ message: "JWT configuration error." });
    }

    const isEmailInput = loginIdentifier.includes("@");
    const query = isEmailInput
      ? { email: loginIdentifier.toLowerCase() }
      : { username: { $regex: new RegExp(`^${loginIdentifier}$`, "i") } };

    const user = await User.findOne(query).select("+password");

    if (!user) {
      return res.status(401).json({ message: "Invalid email/username or password." });
    }

    if (typeof user.password !== "string" || !user.password) {
      console.error(`[AUTH] Missing password hash for user ${user._id}`);
      return res.status(500).json({
        message: "This account does not have a valid password. Please reset the account password.",
      });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);

    if (!isPasswordCorrect) {
      return res.status(401).json({ message: "Invalid email/username or password." });
    }

    const token = jwt.sign(
      { id: String(user._id) },
      process.env.JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.status(200).json({
      message: "Login successful.",
      token,
      user: createSafeUser(user),
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Server error during login." });
  }
};

// =====================================================
// REQUEST PASSWORD RESET
// POST /api/auth/forgot-password
// =====================================================

exports.requestPasswordReset = async (req, res) => {
  const genericResponse = {
    message: "If an account exists for that email, a reset code has been sent.",
  };

  try {
    if (process.env.NODE_ENV === "production" && !hasSmtpConfig()) {
      console.error("Password reset email service is not configured.");
      return res.status(503).json({
        message: "Password reset email service is temporarily unavailable.",
      });
    }

    const email =
      typeof req.body?.email === "string"
        ? req.body.email.trim().toLowerCase()
        : "";

    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    const user = await User.findOne({ email }).select(
      "+passwordResetOtpHash +passwordResetExpiresAt"
    );

    if (!user) {
      return res.status(200).json(genericResponse);
    }

    const otp = String(crypto.randomInt(100000, 1000000));
    const tokenHash = crypto.createHash("sha256").update(otp).digest("hex");

    user.passwordResetOtpHash = tokenHash;
    user.passwordResetExpiresAt = new Date(
      Date.now() + PASSWORD_RESET_MINUTES * 60 * 1000
    );

    await user.save();

    let emailSent = false;

    if (hasSmtpConfig()) {
      try {
        emailSent = await sendPasswordResetOtp({
          recipient: user.email,
          otp,
          expiresInMinutes: PASSWORD_RESET_MINUTES,
        });
      } catch (emailError) {
        console.error("Password reset OTP email failed:", emailError.message);
      }
    }

    if (process.env.NODE_ENV === "production" && !emailSent) {
      return res.status(503).json({
        message: "Password reset email service is temporarily unavailable.",
      });
    }

    return res.status(200).json({
      ...genericResponse,
      ...(!emailSent && process.env.NODE_ENV !== "production" ? { otp } : {}),
    });
  } catch (error) {
    console.error("Password reset request error:", error);
    return res.status(200).json(genericResponse);
  }
};

// =====================================================
// RESET PASSWORD
// POST /api/auth/reset-password
// =====================================================

exports.resetPassword = async (req, res) => {
  try {
    const email =
      typeof req.body?.email === "string"
        ? req.body.email.trim().toLowerCase()
        : "";

    const otp =
      req.body?.otp !== undefined
        ? String(req.body.otp).replace(/\D/g, "")
        : "";

    const password =
      typeof req.body?.password === "string" ? req.body.password : "";

    if (!email || !otp || !password) {
      return res.status(400).json({
        message: "Email, OTP, and new password are required.",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters.",
      });
    }

    const user = await User.findOne({ email }).select(
      "+passwordResetOtpHash +passwordResetExpiresAt"
    );

    if (
      !user ||
      !user.passwordResetOtpHash ||
      !user.passwordResetExpiresAt ||
      user.passwordResetExpiresAt.getTime() <= Date.now()
    ) {
      return res.status(400).json({ message: "This OTP is invalid or expired." });
    }

    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");

    if (otpHash !== user.passwordResetOtpHash) {
      return res.status(400).json({ message: "This OTP is invalid or expired." });
    }

    user.password = await bcrypt.hash(password, 10);
    user.passwordResetOtpHash = null;
    user.passwordResetExpiresAt = null;
    await user.save();

    return res.status(200).json({
      message: "Password reset successfully. You can now log in.",
    });
  } catch (error) {
    console.error("Password reset error:", error);
    return res.status(500).json({ message: "Failed to reset password." });
  }
};

// =====================================================
// GET ALL USERS
// GET /api/auth/users
// =====================================================

exports.getUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select(USER_SELECT_FIELDS)
      .sort({ username: 1 })
      .lean();

    return res.status(200).json(users.map(createSafeUser));
  } catch (error) {
    console.error("Get users error:", error);
    return res.status(500).json({ message: "Failed to fetch users." });
  }
};

// =====================================================
// UPDATE USER LANGUAGE
// PUT /api/auth/language
// =====================================================

exports.updateLanguage = async (req, res) => {
  try {
    const { language } = req.body || {};
    const userId = req.user?.id || req.user?._id;

    if (!userId) {
      return res.status(401).json({ message: "Authentication required." });
    }

    if (!ALLOWED_LANGUAGES.includes(language)) {
      return res.status(400).json({ message: "Unsupported language." });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { language } },
      { new: true, runValidators: true }
    ).select(USER_SELECT_FIELDS);

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    return res.status(200).json({
      message: "Language updated successfully.",
      user: createSafeUser(user),
    });
  } catch (error) {
    console.error("Update language error:", error);
    return res.status(500).json({ message: "Failed to update language." });
  }
};