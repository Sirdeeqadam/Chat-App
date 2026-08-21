const jwt = require("jsonwebtoken");

const authMiddleware = (
  req,
  res,
  next
) => {

  try {

    // ========================================
    // GET AUTHORIZATION HEADER
    // ========================================

    const authHeader =
      req.headers.authorization;


    if (!authHeader) {

      return res.status(401).json({
        message:
          "Authentication required"
      });

    }


    // ========================================
    // CHECK BEARER FORMAT
    // ========================================

    const parts =
      authHeader.split(" ");


    if (
      parts.length !== 2 ||
      parts[0] !== "Bearer" ||
      !parts[1]
    ) {

      return res.status(401).json({
        message:
          "Invalid authorization format"
      });

    }


    const token =
      parts[1];


    // ========================================
    // CHECK JWT SECRET
    // ========================================

    if (!process.env.JWT_SECRET) {

      console.error(
        "JWT_SECRET is missing from .env"
      );

      return res.status(500).json({
        message:
          "JWT configuration error"
      });

    }


    // ========================================
    // VERIFY TOKEN
    // ========================================

    const decoded =
      jwt.verify(
        token,
        process.env.JWT_SECRET
      );


    // ========================================
    // CHECK USER ID
    // ========================================

    if (!decoded.id) {

      return res.status(401).json({
        message:
          "Invalid token payload"
      });

    }


    // ========================================
    // STORE AUTHENTICATED USER
    // ========================================

    req.user = {
      id: decoded.id
    };


    next();

  } catch (error) {

    console.error(
      "Authentication error:",
      error.message
    );


    if (
      error.name ===
      "TokenExpiredError"
    ) {

      return res.status(401).json({
        message:
          "Token has expired"
      });

    }


    return res.status(401).json({
      message:
        "Invalid token"
    });

  }
};


module.exports =
  authMiddleware;