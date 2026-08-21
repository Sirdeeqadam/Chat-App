const jwt = require("jsonwebtoken");
const User = require("../models/User");

const socketAuth = async (
  socket,
  next
) => {
  try {
    // =====================================================
    // GET TOKEN
    // =====================================================

    const token =
      socket.handshake?.auth?.token;

    if (!token) {
      return next(
        new Error(
          "Authentication required"
        )
      );
    }

    // =====================================================
    // JWT CONFIG
    // =====================================================

    if (!process.env.JWT_SECRET) {
      console.error(
        "JWT_SECRET is missing from .env"
      );

      return next(
        new Error(
          "JWT configuration error"
        )
      );
    }

    // =====================================================
    // VERIFY TOKEN
    // =====================================================

    let decoded;

    try {
      decoded =
        jwt.verify(
          token,
          process.env.JWT_SECRET
        );
    } catch (error) {
      if (
        error?.name ===
        "TokenExpiredError"
      ) {
        return next(
          new Error(
            "Token has expired"
          )
        );
      }

      return next(
        new Error(
          "Invalid token"
        )
      );
    }

    // =====================================================
    // VALIDATE PAYLOAD
    // =====================================================

    if (!decoded?.id) {
      return next(
        new Error(
          "Invalid token payload"
        )
      );
    }

    const userId =
      String(decoded.id);

    // =====================================================
    // LOAD USER
    // =====================================================

    const user =
      await User.findById(
        userId
      ).select(
        "_id username email language"
      );

    if (!user) {
      return next(
        new Error(
          "User account no longer exists"
        )
      );
    }

    // =====================================================
    // STORE AUTHENTICATED USER DATA
    // =====================================================

    socket.userId =
      String(user._id);

    socket.username =
      user.username;

    socket.userLanguage =
      user.language || "English";

    console.log(
      `[SOCKET AUTH] user=${socket.userId}, username=${socket.username}, language=${socket.userLanguage}`
    );

    return next();
  } catch (error) {
    console.error(
      "Socket authentication error:",
      error
    );

    return next(
      new Error(
        "Socket authentication failed"
      )
    );
  }
};

module.exports =
  socketAuth;