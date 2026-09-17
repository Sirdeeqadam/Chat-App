const jwt = require("jsonwebtoken");
const User = require("../models/User");

const socketAuth = async (socket, next) => {
  try {
    const token = socket.handshake?.auth?.token;

    if (!token) {
      return next(new Error("Authentication required"));
    }

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is missing from environment variables");
      return next(new Error("JWT configuration error"));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded?.id) {
      return next(new Error("Invalid token payload"));
    }

    const user = await User.findById(decoded.id).select(
      "_id username email language profilePicture"
    );

    if (!user) {
      return next(new Error("User account no longer exists"));
    }

    socket.userId = String(user._id);
    socket.username = user.username || "User";
    socket.userLanguage = user.language || "English";
    socket.profilePicture = user.profilePicture || null;

    return next();
  } catch (error) {
    console.error("Socket authentication error:", error.message);

    if (error.name === "TokenExpiredError") {
      return next(new Error("Token has expired"));
    }

    return next(new Error("Invalid token"));
  }
};

module.exports = socketAuth;
