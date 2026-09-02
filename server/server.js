require("dotenv").config();

const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const { Server } = require("socket.io");

// =========================================================
// ROUTES
// =========================================================

const authRoutes =
  require("./routes/authRoutes");

const messageRoutes =
  require("./routes/messageRoutes");

const roomRoutes =
  require("./routes/roomRoutes");

const readStateRoutes =
  require("./routes/readStateRoutes");

const profileRoutes =
  require("./routes/profileRoutes");

const friendRoutes =
  require("./routes/friendRoutes");

const searchRoutes =
  require("./routes/searchRoutes");

// =========================================================
// SOCKET
// =========================================================

const initializeChatSocket =
  require("./sockets/chatSocket");

const socketAuth =
  require("./middleware/socketAuth");

// =========================================================
// APP
// =========================================================

const app = express();

const server =
  http.createServer(app);

// =========================================================
// CONFIGURATION
// =========================================================

const PORT =
  Number(process.env.PORT) || 5000;

const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5174",
];

// Add configured frontend URL.
if (
  process.env.FRONTEND_URL
) {
  const frontendUrl =
    process.env.FRONTEND_URL
      .trim()
      .replace(/\/$/, "");

  if (frontendUrl) {
    allowedOrigins.push(
      frontendUrl
    );
  }
}

// =========================================================
// CORS HELPER
// =========================================================

const isAllowedOrigin = (
  origin
) => {
  // Allow requests such as
  // curl/Postman that have no
  // Origin header.
  if (!origin) {
    return true;
  }

  const normalizedOrigin =
    String(origin)
      .trim()
      .replace(/\/$/, "");

  if (
    allowedOrigins.includes(
      normalizedOrigin
    )
  ) {
    return true;
  }

  // Allow Vercel frontend deployments.
  return /\.vercel\.app$/i.test(
    normalizedOrigin
  );
};

// =========================================================
// EXPRESS CORS
// =========================================================

app.use(
  cors({
    origin: (
      origin,
      callback
    ) => {
      if (
        isAllowedOrigin(origin)
      ) {
        return callback(
          null,
          true
        );
      }

      console.warn(
        `[CORS] Blocked origin: ${origin}`
      );

      return callback(
        new Error(
          "Not allowed by CORS"
        )
      );
    },

    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
    ],

    credentials: true,
  })
);

// =========================================================
// BODY PARSERS
// =========================================================

app.use(
  express.json({
    limit: "10mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "10mb",
  })
);

// =========================================================
// STATIC UPLOADS
// =========================================================
//
// Profile images are stored under:
//
// server/uploads/profiles/
//
// and accessed through:
//
// /uploads/profiles/<filename>
//
// =========================================================

app.use(
  "/uploads",
  express.static(
    path.join(
      __dirname,
      "uploads"
    )
  )
);

// =========================================================
// SOCKET.IO
// =========================================================

const io =
  new Server(server, {
    cors: {
      origin: (
        origin,
        callback
      ) => {
        if (
          isAllowedOrigin(origin)
        ) {
          return callback(
            null,
            true
          );
        }

        console.warn(
          `[Socket.IO CORS] Blocked origin: ${origin}`
        );

        return callback(
          new Error(
            "Socket.IO CORS blocked"
          )
        );
      },

      methods: [
        "GET",
        "POST",
      ],

      credentials: true,
    },

    // Prevent oversized Socket.IO packets.
    maxHttpBufferSize:
      1e6,
  });

// Make Socket.IO accessible
// to REST route handlers.
//
// Example:
//
// const io = req.app.get("io");
//
app.set(
  "io",
  io
);

// =========================================================
// BASIC ROUTE
// =========================================================

app.get(
  "/",
  (req, res) => {
    return res
      .status(200)
      .send(
        "Multilingual Chat Server Running..."
      );
  }
);

// =========================================================
// HEALTH CHECK
// =========================================================

app.get(
  "/api/health",
  (req, res) => {
    const mongoState =
      mongoose.connection
        .readyState;

    let mongodb =
      "disconnected";

    if (
      mongoState === 1
    ) {
      mongodb =
        "connected";
    } else if (
      mongoState === 2
    ) {
      mongodb =
        "connecting";
    } else if (
      mongoState === 3
    ) {
      mongodb =
        "disconnecting";
    }

    return res
      .status(200)
      .json({
        status: "ok",

        message:
          "Server is running",

        mongodb,

        socket:
          io.engine
            ? "available"
            : "unavailable",

        timestamp:
          new Date().toISOString(),
      });
  }
);

// =========================================================
// REST API ROUTES
// =========================================================

app.use(
  "/api/auth",
  authRoutes
);

app.use(
  "/api/messages",
  messageRoutes
);

app.use(
  "/api/rooms",
  roomRoutes
);

app.use(
  "/api/read-state",
  readStateRoutes
);

app.use(
  "/api/profile",
  profileRoutes
);

app.use(
  "/api/friends",
  friendRoutes
);

app.use(
  "/api/search",
  searchRoutes
);

// =========================================================
// SOCKET AUTHENTICATION
// =========================================================
//
// JWT is verified before a
// Socket.IO connection is accepted.
// =========================================================

io.use(
  socketAuth
);

// =========================================================
// DATABASE
// =========================================================

const connectDatabase =
  async () => {
    if (
      !process.env.MONGO_URI
    ) {
      throw new Error(
        "MONGO_URI is not defined in environment variables"
      );
    }

    await mongoose.connect(
      process.env.MONGO_URI
    );

    console.log(
      "MongoDB Connected"
    );
};

// =========================================================
// DATABASE EVENTS
// =========================================================

mongoose.connection.on(
  "connected",
  () => {
    console.log(
      "Mongoose connection established"
    );
  }
);

mongoose.connection.on(
  "error",
  (error) => {
    console.error(
      "MongoDB runtime error:",
      error
    );
  }
);

mongoose.connection.on(
  "disconnected",
  () => {
    console.warn(
      "MongoDB disconnected"
    );
  }
);

// =========================================================
// SERVER STATE
// =========================================================

let serverStarted =
  false;

let isShuttingDown =
  false;

// =========================================================
// START SERVER
// =========================================================

const startServer =
  async () => {
    try {
      // Connect to MongoDB first.
      await connectDatabase();

      // Initialize Socket.IO
      // after the database is ready.
      initializeChatSocket(
        io
      );

      server.listen(
        PORT,
        () => {
          serverStarted =
            true;

          console.log(
            "=========================================="
          );

          console.log(
            `Server running on port ${PORT}`
          );

          console.log(
            `API: http://localhost:${PORT}/api`
          );

          console.log(
            `Health: http://localhost:${PORT}/api/health`
          );

          console.log(
            `Socket.IO: http://localhost:${PORT}`
          );

          console.log(
            `Uploads: http://localhost:${PORT}/uploads`
          );

          console.log(
            "=========================================="
          );
        }
      );
    } catch (error) {
      console.error(
        "Server startup error:",
        error
      );

      process.exit(1);
    }
  };

startServer();

// =========================================================
// 404 HANDLER
// =========================================================

app.use(
  (req, res) => {
    return res
      .status(404)
      .json({
        message:
          "API route not found",
      });
  }
);

// =========================================================
// EXPRESS ERROR HANDLER
// =========================================================

app.use(
  (
    error,
    req,
    res,
    next
  ) => {
    console.error(
      "[EXPRESS ERROR]",
      error
    );

    if (
      res.headersSent
    ) {
      return next(error);
    }

    // -----------------------------------------------------
    // Multer file-size error
    // -----------------------------------------------------

    if (
      error?.code ===
      "LIMIT_FILE_SIZE"
    ) {
      return res
        .status(400)
        .json({
          message:
            "Profile picture must be 5 MB or smaller.",
        });
    }

    // -----------------------------------------------------
    // Multer upload errors
    // -----------------------------------------------------

    if (
      error?.name ===
      "MulterError"
    ) {
      return res
        .status(400)
        .json({
          message:
            error.message ||
            "File upload failed.",
        });
    }

    return res
      .status(
        error.status || 500
      )
      .json({
        message:
          error.message ||
          "Internal server error",
      });
  }
);

// =========================================================
// GRACEFUL SHUTDOWN
// =========================================================

const shutdown =
  async (signal) => {
    if (
      isShuttingDown
    ) {
      return;
    }

    isShuttingDown =
      true;

    console.log(
      `${signal} received. Shutting down...`
    );

    // -----------------------------------------------------
    // Stop Socket.IO
    // -----------------------------------------------------

    try {
      io.close();

      console.log(
        "Socket.IO closed"
      );
    } catch (error) {
      console.error(
        "Socket.IO shutdown error:",
        error
      );
    }

    // -----------------------------------------------------
    // Server has not started
    // -----------------------------------------------------

    if (
      !serverStarted
    ) {
      try {
        if (
          mongoose.connection
            .readyState !==
          0
        ) {
          await mongoose.connection.close();

          console.log(
            "MongoDB connection closed"
          );
        }

        process.exit(0);
      } catch (error) {
        console.error(
          "Shutdown error:",
          error
        );

        process.exit(1);
      }

      return;
    }

    // -----------------------------------------------------
    // Close HTTP server
    // -----------------------------------------------------

    server.close(
      async (serverError) => {
        if (serverError) {
          console.error(
            "HTTP server shutdown error:",
            serverError
          );
        }

        try {
          if (
            mongoose.connection
              .readyState !==
            0
          ) {
            await mongoose.connection.close();

            console.log(
              "MongoDB connection closed"
            );
          }

          process.exit(
            serverError
              ? 1
              : 0
          );
        } catch (error) {
          console.error(
            "Shutdown error:",
            error
          );

          process.exit(1);
        }
      }
    );
  };

// =========================================================
// PROCESS SIGNALS
// =========================================================

process.on(
  "SIGINT",
  () => {
    shutdown("SIGINT");
  }
);

process.on(
  "SIGTERM",
  () => {
    shutdown("SIGTERM");
  }
);

// =========================================================
// UNHANDLED REJECTION
// =========================================================

process.on(
  "unhandledRejection",
  (reason) => {
    console.error(
      "Unhandled promise rejection:",
      reason
    );
  }
);

// =========================================================
// UNCAUGHT EXCEPTION
// =========================================================

process.on(
  "uncaughtException",
  (error) => {
    console.error(
      "Uncaught exception:",
      error
    );

    shutdown(
      "uncaughtException"
    );
  }
);