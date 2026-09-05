const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { sendEmail } = require("../utils/sendEmail");

// Helper: Generate 6-digit numeric OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();
const isStrongPassword = (password) =>
  password.length >= 6 &&
  /[A-Za-z]/.test(password) &&
  /\d/.test(password) &&
  /[^A-Za-z0-9]/.test(password);
const passwordRequirementsMessage =
  "Password must be at least 6 characters and include a letter, a number, and a special character.";

// =====================================================
// 1. REGISTER USER
// =====================================================
exports.registerUser = async (req, res) => {
  try {
    const { username, email, password, language } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: "All required fields must be provided." });
    }

    if (!isStrongPassword(password)) {
      return res.status(400).json({ message: passwordRequirementsMessage });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanUsername = username.trim();

    const existingEmailUser = await User.findOne({ email: cleanEmail }).select(
      "+verificationCodeHash +verificationCodeExpiresAt"
    );

    if (existingEmailUser) {
      if (existingEmailUser.isVerified) {
        return res.status(400).json({ message: "This email is already registered. Please log in." });
      }

      const otp = generateOTP();
      existingEmailUser.verificationCodeHash = otp;
      existingEmailUser.verificationCodeExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
      await existingEmailUser.save();

      try {
        await sendEmail({
          to: existingEmailUser.email,
          subject: "Verify Your Email - New Verification Code",
          html: `<h2>Welcome back, ${existingEmailUser.username}!</h2><p>Your new email verification code is: <strong>${otp}</strong></p><p>This code expires in 10 minutes.</p>`,
          text: `Your new email verification code is: ${otp}`,
        });
      } catch (emailErr) {
        console.error("[REGISTER EXISTING EMAIL SEND ERROR]", emailErr);
        return res.status(503).json({
          message: "This account is pending verification, but the OTP email could not be sent.",
          email: existingEmailUser.email,
        });
      }

      return res.status(200).json({
        message: "This account is pending verification. A new OTP has been sent.",
        email: existingEmailUser.email,
        otp: process.env.NODE_ENV === "development" ? otp : undefined,
      });
    }

    const existingUsername = await User.findOne({ username: cleanUsername });
    if (existingUsername) {
      return res.status(400).json({ message: "User with this email or username already exists." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    // Create user matching your exact MongoDB schema fields
    const newUser = await User.create({
      username: cleanUsername,
      email: cleanEmail,
      password: hashedPassword,
      language: language || "English",
      isVerified: false,
      verificationCodeHash: otp,
      verificationCodeExpiresAt: otpExpires,
      profilePicture: null,
      bio: "",
    });

    try {
      await sendEmail({
        to: newUser.email,
        subject: "Verify Your Email - Verification Code",
        html: `<h2>Welcome, ${newUser.username}!</h2><p>Your email verification code is: <strong>${otp}</strong></p><p>This code expires in 10 minutes.</p>`,
        text: `Your email verification code is: ${otp}`,
      });
    } catch (emailErr) {
      console.error("[REGISTER EMAIL SEND ERROR]", emailErr);
      return res.status(503).json({
        message: "Account created, but the verification email could not be sent. Please try Resend OTP.",
        email: newUser.email,
      });
    }

    return res.status(201).json({
      message: "Registration successful. Please verify your email with the OTP sent.",
      email: newUser.email,
      otp: process.env.NODE_ENV === "development" ? otp : undefined,
    });
  } catch (error) {
    console.error("[REGISTER ERROR]", error);
    return res.status(500).json({ message: "Internal server error during registration.", error: error.message });
  }
};

// =====================================================
// 2. VERIFY EMAIL OTP
// =====================================================
exports.verifyEmail = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required." });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select(
      "+verificationCodeHash +verificationCodeExpiresAt"
    );

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: "Email is already verified. Please log in." });
    }

    const storedOtp = String(user.verificationCodeHash || "").trim();
    const inputOtp = String(otp || "").trim();

    if (
      !storedOtp ||
      storedOtp !== inputOtp ||
      !user.verificationCodeExpiresAt ||
      new Date() > new Date(user.verificationCodeExpiresAt)
    ) {
      return res.status(400).json({ message: "Invalid or expired OTP code." });
    }

    user.isVerified = true;
    user.verificationCodeHash = null;
    user.verificationCodeExpiresAt = null;
    await user.save();

    return res.status(200).json({ message: "Email verified successfully. You can now log in." });
  } catch (error) {
    console.error("[VERIFY EMAIL ERROR]", error);
    return res.status(500).json({ message: "Internal server error during email verification." });
  }
};

// =====================================================
// 3. RESEND VERIFICATION OTP
// =====================================================
exports.resendVerificationOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select(
      "+verificationCodeHash +verificationCodeExpiresAt"
    );

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: "Email is already verified." });
    }

    const otp = generateOTP();
    user.verificationCodeHash = otp;
    user.verificationCodeExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    try {
      await sendEmail({
        to: user.email,
        subject: "Verify Your Email - New Verification Code",
        html: `<p>Your new verification code is: <strong>${otp}</strong></p>`,
        text: `Your new verification code is: ${otp}`,
      });
    } catch (emailErr) {
      console.error("[RESEND EMAIL ERROR]", emailErr);
      return res.status(503).json({
        message: "The OTP could not be sent. Please check the email configuration and try again.",
      });
    }

    return res.status(200).json({
      message: "A new OTP code has been sent to your email.",
      otp: process.env.NODE_ENV === "development" ? otp : undefined,
    });
  } catch (error) {
    console.error("[RESEND OTP ERROR]", error);
    return res.status(500).json({ message: "Internal server error resending OTP." });
  }
};

// =====================================================
// 4. LOGIN USER
// =====================================================
exports.loginUser = async (req, res) => {
  try {
    const { identifier, email, username, password } = req.body;
    const rawLoginInput = (identifier || email || username || "").trim();
    const emailLoginInput = rawLoginInput.toLowerCase();

    if (!rawLoginInput || !password) {
      return res.status(400).json({ message: "Please provide credentials and password." });
    }

    const user = await User.findOne({
      $or: [{ email: emailLoginInput }, { username: rawLoginInput }],
    }).select("+password +verificationCodeHash +verificationCodeExpiresAt");

    if (!user) {
      return res.status(401).json({ message: "Invalid email/username or password." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email/username or password." });
    }

    // Handle unverified user login attempt
    if (!user.isVerified) {
      const otp = generateOTP();
      user.verificationCodeHash = otp;
      user.verificationCodeExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
      await user.save();

      try {
        await sendEmail({
          to: user.email,
          subject: "Verify Your Email - New Verification Code",
          html: `<p>Your new email verification code is: <strong>${otp}</strong></p>`,
          text: `Your new email verification code is: ${otp}`,
        });
      } catch (emailErr) {
        console.error("[LOGIN EMAIL ERROR]", emailErr);
        return res.status(503).json({
          message: "Your email is not verified, but a new OTP could not be sent. Please try Resend OTP.",
          unverified: true,
          email: user.email,
        });
      }

      return res.status(403).json({
        message: "Email is not verified. A new OTP has been sent to your email.",
        unverified: true,
        email: user.email,
      });
    }

    const token = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    return res.status(200).json({
      message: "Login successful.",
      token,
      user: { id: user._id, username: user.username, email: user.email, language: user.language },
    });
  } catch (error) {
    console.error("[LOGIN ERROR]", error);
    return res.status(500).json({ message: "Internal server error during login.", error: error.message });
  }
};

// =====================================================
// 5. REQUEST PASSWORD RESET (FORGOT PASSWORD)
// =====================================================
exports.requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email address is required." });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select(
      "+passwordResetOtpHash +passwordResetExpiresAt"
    );
    if (!user) {
      return res.status(200).json({ message: "If that email exists, an OTP has been sent." });
    }

    const otp = generateOTP();
    user.passwordResetOtpHash = otp;
    user.passwordResetExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    try {
      await sendEmail({
        to: user.email,
        subject: "Password Reset Code",
        html: `<p>Your password reset OTP code is: <strong>${otp}</strong></p><p>Expires in 10 minutes.</p>`,
        text: `Your password reset OTP code is: ${otp}`,
      });
    } catch (emailErr) {
      console.error("[FORGOT PASSWORD EMAIL ERROR]", emailErr);
      return res.status(503).json({
        message: "The password-reset OTP could not be sent. Please check the email configuration and try again.",
      });
    }

    return res.status(200).json({
      message: "Check your email for the password reset OTP.",
      otp: process.env.NODE_ENV === "development" ? otp : undefined,
    });
  } catch (error) {
    console.error("[FORGOT PASSWORD ERROR]", error);
    return res.status(500).json({ message: "Internal server error during password reset request." });
  }
};

// =====================================================
// 6. RESET PASSWORD
// =====================================================
exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, password } = req.body;

    if (!email || !otp || !password) {
      return res.status(400).json({ message: "Email, OTP, and new password are required." });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select(
      "+passwordResetOtpHash +passwordResetExpiresAt"
    );

    if (!isStrongPassword(password)) {
      return res.status(400).json({ message: passwordRequirementsMessage });
    }
    if (!user) {
      return res.status(400).json({ message: "Invalid request." });
    }

    const storedOtp = String(user.passwordResetOtpHash || "").trim();
    const inputOtp = String(otp || "").trim();

    if (
      !storedOtp ||
      storedOtp !== inputOtp ||
      !user.passwordResetExpiresAt ||
      new Date() > new Date(user.passwordResetExpiresAt)
    ) {
      return res.status(400).json({ message: "Invalid or expired OTP." });
    }

    user.password = await bcrypt.hash(password, 10);
    user.passwordResetOtpHash = null;
    user.passwordResetExpiresAt = null;
    await user.save();

    return res.status(200).json({ message: "Password reset successful. You can now log in." });
  } catch (error) {
    console.error("[RESET PASSWORD ERROR]", error);
    return res.status(500).json({ message: "Internal server error resetting password." });
  }
};

// =====================================================
// 7. GET ALL USERS (FOR CHAT APP LISTS)
// =====================================================
exports.getUsers = async (req, res) => {
  try {
    const users = await User.find({}, "_id username email language isVerified").lean();
    return res.status(200).json(users);
  } catch (error) {
    console.error("[GET USERS ERROR]", error);
    return res.status(500).json({ message: "Internal server error fetching users." });
  }
};

// =====================================================
// 8. UPDATE PREFERRED LANGUAGE
// =====================================================
exports.updateLanguage = async (req, res) => {
  try {
    const { language } = req.body;
    if (!language) {
      return res.status(400).json({ message: "Language preference is required." });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { language },
      { new: true, select: "-password" }
    );

    return res.status(200).json({ message: "Language updated successfully.", user });
  } catch (error) {
    console.error("[UPDATE LANGUAGE ERROR]", error);
    return res.status(500).json({ message: "Internal server error updating language." });
  }
};