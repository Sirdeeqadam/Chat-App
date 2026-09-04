const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

// =========================================================
// HELPER FUNCTIONS
// =========================================================

// SHA-256 hash helper for OTPs and tokens
const hashToken = (token) => {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
};

// Generate standard JWT
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET || "fallback_secret", {
    expiresIn: "7d",
  });
};

// Generate 6-digit numeric OTP
const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// =========================================================
// REGISTER USER
// =========================================================
exports.registerUser = async (req, res, next) => {
  try {
    const { username, email, password, language } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: "Username, email, and password are required." });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check for existing user
    const existingUser = await User.findOne({
      $or: [{ email: normalizedEmail }, { username: username.trim() }],
    });

    if (existingUser) {
      // If the existing account is unverified, don't hard-block the user —
      // they likely hit this because a previous attempt appeared to fail.
      // Refresh their OTP and re-send instead of leaving them stuck.
      if (existingUser.email === normalizedEmail && !existingUser.isVerified) {
        const otp = generateOtp();
        existingUser.verificationCodeHash = hashToken(otp);
        existingUser.verificationCodeExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
        await existingUser.save();

        // Respond immediately — do not make the client wait on Gmail's SMTP round-trip.
        // Waiting here is what caused "Server unreachable or timed out" on the frontend
        // even though the account update itself succeeded.
        res.status(200).json({
          success: true,
          message: "This account is already registered but not verified. A new verification code has been sent to your email.",
          user: {
            id: existingUser._id,
            username: existingUser.username,
            email: existingUser.email,
            isVerified: existingUser.isVerified,
            language: existingUser.language,
          },
        });

        const transporter = req.app.get("transporter");
        if (transporter) {
          transporter
            .sendMail({
              from: `Chat App <${process.env.NODE_CODE_SENDING_EMAIL_ADDRESS}>`,
              to: existingUser.email,
              subject: "Verify Your Email - Multilingual Chat",
              html: `<p>Welcome back, <strong>${existingUser.username}</strong>!</p>
                     <p>Your email verification code is: <b style="font-size: 18px;">${otp}</b></p>
                     <p>This code will expire in 15 minutes.</p>`,
            })
            .catch((mailError) => {
              console.error("[Email][register-existing-unverified] Background send failed:", mailError.message);
            });
        } else {
          console.warn("[Email][register-existing-unverified] Transporter not available on app instance.");
        }

        return;
      }

      if (existingUser.email === normalizedEmail) {
        return res.status(400).json({ message: "An account with this email already exists." });
      }
      return res.status(400).json({ message: "Username is already taken." });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Generate Verification OTP
    const otp = generateOtp();
    const otpHash = hashToken(otp);
    const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    const newUser = await User.create({
      username: username.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      language: language || "English",
      isVerified: false,
      verificationCodeHash: otpHash,
      verificationCodeExpiresAt: otpExpiresAt,
    });

    // Respond to the frontend IMMEDIATELY — don't make the client wait on Gmail's
    // SMTP round-trip. This is what was causing "Server unreachable or timed out"
    // even though the user account had already been created successfully.
    res.status(201).json({
      success: true,
      message: "Registration successful. Please check your email for verification code.",
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        isVerified: newUser.isVerified,
        language: newUser.language,
      },
    });

    // Send Verification Email in the background, after the response has gone out.
    // Any failure here is only logged — the user already has their account and
    // can always use "Resend Code" to get a fresh OTP.
    const transporter = req.app.get("transporter");
    if (transporter) {
      transporter
        .sendMail({
          from: `Chat App <${process.env.NODE_CODE_SENDING_EMAIL_ADDRESS}>`,
          to: newUser.email,
          subject: "Verify Your Email - Multilingual Chat",
          html: `<p>Welcome, <strong>${newUser.username}</strong>!</p>
                 <p>Your email verification code is: <b style="font-size: 18px;">${otp}</b></p>
                 <p>This code will expire in 15 minutes.</p>`,
        })
        .catch((mailError) => {
          console.error("[Email][register] Background send failed:", mailError.message);
        });
    } else {
      console.warn("[Email][register] Transporter not available on app instance.");
    }
  } catch (error) {
    return next(error);
  }
};

// =========================================================
// VERIFY EMAIL OTP
// =========================================================
exports.verifyEmail = async (req, res, next) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ message: "Email and verification code are required." });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Select explicit hidden verification fields
    const user = await User.findOne({ email: normalizedEmail }).select(
      "+verificationCodeHash +verificationCodeExpiresAt"
    );

    if (!user) {
      return res.status(400).json({ message: "Verification code is invalid or expired." });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: "Email is already verified." });
    }

    if (!user.verificationCodeHash || !user.verificationCodeExpiresAt) {
      return res.status(400).json({ message: "Verification code is invalid or expired." });
    }

    if (user.verificationCodeExpiresAt < new Date()) {
      return res.status(400).json({ message: "Verification code has expired. Please request a new one." });
    }

    const inputHash = hashToken(code.trim());
    if (inputHash !== user.verificationCodeHash) {
      return res.status(400).json({ message: "Verification code is invalid or expired." });
    }

    // Verify user & clear OTP fields
    user.isVerified = true;
    user.verificationCodeHash = undefined;
    user.verificationCodeExpiresAt = undefined;
    await user.save();

    const token = generateToken(user._id);

    return res.status(200).json({
      success: true,
      message: "Email verified successfully.",
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        isVerified: true,
        language: user.language,
      },
    });
  } catch (error) {
    return next(error);
  }
};

// =========================================================
// RESEND VERIFICATION OTP
// =========================================================
exports.resendVerificationOtp = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: "Email is already verified." });
    }

    const otp = generateOtp();
    const otpHash = hashToken(otp);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    user.verificationCodeHash = otpHash;
    user.verificationCodeExpiresAt = expiresAt;
    await user.save();

    // Respond immediately — don't make the client wait on Gmail's SMTP round-trip.
    res.status(200).json({
      success: true,
      message: "A new verification code has been sent to your email.",
    });

    const transporter = req.app.get("transporter");
    if (transporter) {
      transporter
        .sendMail({
          from: `Chat App <${process.env.NODE_CODE_SENDING_EMAIL_ADDRESS}>`,
          to: user.email,
          subject: "Your Email Verification Code",
          html: `<p>Your new verification code is: <b style="font-size: 18px;">${otp}</b></p>
                 <p>This code will expire in 15 minutes.</p>`,
        })
        .catch((mailError) => {
          console.error("[Email][resend-otp] Background send failed:", mailError.message);
        });
    } else {
      console.warn("[Email][resend-otp] Transporter not available on app instance.");
    }
  } catch (error) {
    return next(error);
  }
};

// =========================================================
// LOGIN USER
// =========================================================
exports.loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Select hidden password
    const user = await User.findOne({ email: normalizedEmail }).select("+password");

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    if (!user.isVerified) {
      return res.status(403).json({
        message: "Please verify your email address before logging in.",
        isVerified: false,
      });
    }

    const token = generateToken(user._id);

    return res.status(200).json({
      success: true,
      message: "Logged in successfully.",
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        language: user.language,
        bio: user.bio,
        profilePicture: user.profilePicture,
        isVerified: user.isVerified,
      },
    });
  } catch (error) {
    return next(error);
  }
};

// =========================================================
// REQUEST PASSWORD RESET (OTP)
// =========================================================
exports.requestPasswordReset = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(200).json({
        success: true,
        message: "If an account exists with that email, a password reset code has been sent.",
      });
    }

    const otp = generateOtp();
    const otpHash = hashToken(otp);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    user.passwordResetOtpHash = otpHash;
    user.passwordResetExpiresAt = expiresAt;
    await user.save();

    // Respond immediately — don't make the client wait on Gmail's SMTP round-trip.
    res.status(200).json({
      success: true,
      message: "If an account exists with that email, a password reset code has been sent.",
    });

    const transporter = req.app.get("transporter");
    if (transporter) {
      transporter
        .sendMail({
          from: `Chat App <${process.env.NODE_CODE_SENDING_EMAIL_ADDRESS}>`,
          to: user.email,
          subject: "Password Reset Request",
          html: `<p>Your password reset code is: <b style="font-size: 18px;">${otp}</b></p>
                 <p>This code will expire in 15 minutes.</p>`,
        })
        .catch((mailError) => {
          console.error("[Email][forgot-password] Background send failed:", mailError.message);
        });
    } else {
      console.warn("[Email][forgot-password] Transporter not available on app instance.");
    }
  } catch (error) {
    return next(error);
  }
};

// =========================================================
// RESET PASSWORD
// =========================================================
exports.resetPassword = async (req, res, next) => {
  try {
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
      return res.status(400).json({ message: "Email, code, and new password are required." });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters long." });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail }).select(
      "+passwordResetOtpHash +passwordResetExpiresAt"
    );

    if (
      !user ||
      !user.passwordResetOtpHash ||
      !user.passwordResetExpiresAt ||
      user.passwordResetExpiresAt < new Date()
    ) {
      return res.status(400).json({ message: "Invalid or expired password reset code." });
    }

    const inputHash = hashToken(code.trim());
    if (inputHash !== user.passwordResetOtpHash) {
      return res.status(400).json({ message: "Invalid or expired password reset code." });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.passwordResetOtpHash = undefined;
    user.passwordResetExpiresAt = undefined;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password reset successful. You can now log in with your new password.",
    });
  } catch (error) {
    return next(error);
  }
};

// =========================================================
// GET USERS
// =========================================================
exports.getUsers = async (req, res, next) => {
  try {
    const users = await User.find().select("username email profilePicture language bio isVerified");
    return res.status(200).json({ success: true, users });
  } catch (error) {
    return next(error);
  }
};

// =========================================================
// UPDATE LANGUAGE
// =========================================================
exports.updateLanguage = async (req, res, next) => {
  try {
    const { language } = req.body;
    const allowedLanguages = ["English", "Hausa", "French", "Arabic"];

    if (!language || !allowedLanguages.includes(language)) {
      return res.status(400).json({
        message: `Invalid language. Allowed values: ${allowedLanguages.join(", ")}`,
      });
    }

    const user = await User.findById(req.user._id || req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    user.language = language;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Language setting updated.",
      language: user.language,
    });
  } catch (error) {
    return next(error);
  }
};