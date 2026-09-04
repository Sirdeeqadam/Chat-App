require("dotenv").config();

const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const nodemailer = require("nodemailer");
const { Server } = require("socket.io");

// =========================================================
// ROUTES
// =========================================================

const authRoutes = require("./routes/authRoutes");
const messageRoutes = require("./routes/messageRoutes");
const roomRoutes = require("./routes/roomRoutes");
const readStateRoutes = require("./routes/readStateRoutes");
const profileRoutes = require("./routes/profileRoutes");
const friendRoutes = require("./routes/friendRoutes");
const searchRoutes = require("./routes/searchRoutes");

// =========================================================
// SOCKET & MIDDLEWARE
// =========================================================

const initializeChatSocket = require("./sockets/chatSocket");
const socketAuth = require("./middleware/socketAuth");

// =========================================================
// APP & SERVER INITIALIZATION
// =========================================================

const app = express();
const server = http.createServer(app);

// =========================================================
// NODEMAILER TRANSPORTER SETUP
// =========================================================

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.NODE_CODE_SENDING_EMAIL_ADDRESS,
    pass: process.env.NODE_CODE_SENDING_EMAIL_PASSWORD, // Uses 16-character App Password
  },
  // Force IPv4 only. Render (and some other hosts) don't route outbound IPv6
  // to Gmail's SMTP servers, which causes "connect ENETUNREACH" errors when
  // Nodemailer tries an IPv6 address first. Forcing IPv4 avoids that entirely.
  family: 4,
  // Prevent requests from hanging indefinitely if a connection attempt stalls.
  connectionTimeout: 10000, // 10 seconds
  greetingTimeout: 5000,
  socketTimeout: 10000,
});

// Verify email service configuration on startup
transporter.verify((error) => {
  if (error) {
    console.warn("[Nodemailer] Warning: Email service error ->", error.message);
  } else {
    console.log("[Nodemailer] Transporter is ready to dispatch emails");
  }
});

// Attach transporter to app instance for global route access
app.set("transporter", transporter);

// =========================================================
// CONFIGURATION & CORS SETUP
// =========================================================

const PORT = Number(process.env.PORT) || 5000;

const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5174",
  "http://localhost:3000",
];

if (process.env.FRONTEND_URL) {
  const frontendUrl = process.env.FRONTEND_URL.trim().replace(/\/$/, "");
  if (frontendUrl) {
    allowedOrigins.push(frontendUrl);
  }
}

const isAllowedOrigin = (origin) => {
  if (!origin) return true;

  const normalizedOrigin = String(origin).trim().replace(/\/$/, "");

  if (allowedOrigins.includes(normalizedOrigin)) return true;

  return (
    /\.vercel\.app$/i.test(normalizedOrigin) ||
    /\.onrender\.com$/i.test(normalizedOrigin) ||
    /\.netlify\.app$/i.test(normalizedOrigin) ||
    /^http:\/\/localhost:\d+$/i.test(normalizedOrigin)
  );
};

// =========================================================
// EXPRESS MIDDLEWARE
// =========================================================

app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        return callback(null, true);
      }

      console.warn(`[CORS] Blocked origin: ${origin}`);
      return callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Static uploads route
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// =========================================================
// SOCKET.IO SETUP
// =========================================================

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        return callback(null, true);
      }

      console.warn(`[Socket.IO CORS] Blocked origin: ${origin}`);
      return callback(new Error("Socket.IO CORS blocked"));
    },
    methods: ["GET", "POST"],
    credentials: true,
  },
  maxHttpBufferSize: 1e6,
});

app.set("io", io);

// =========================================================
// API & HEALTH ROUTES
// =========================================================

app.get("/", (req, res) => {
  return res.status(200).send("Multilingual Chat Server Running...");
});

app.get("/api/health", (req, res) => {
  const mongoState = mongoose.connection.readyState;
  const states = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
  };

  return res.status(200).json({
    status: "ok",
    message: "Server is running",
    mongodb: states[mongoState] || "unknown",
    socket: io.engine ? "available" : "unavailable",
    timestamp: new Date().toISOString(),
  });
});

// Route for sending email notifications
app.post("/api/send-email", async (req, res, next) => {
  const { to, subject, message, html } = req.body;

  if (!to || (!message && !html)) {
    return res.status(400).json({ message: "Recipient 'to' and email body content are required." });
  }

  try {
    const info = await transporter.sendMail({
      from: `Chat App <${process.env.NODE_CODE_SENDING_EMAIL_ADDRESS}>`,
      to,
      subject: subject || "Notification from Multilingual Chat",
      text: message || "",
      html: html || `<p>${message}</p>`,
    });

    return res.status(200).json({ success: true, messageId: info.messageId });
  } catch (error) {
    return next(error);
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/read-state", readStateRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/friends", friendRoutes);
app.use("/api/search", searchRoutes);

// Socket Auth Middleware
io.use(socketAuth);

// =========================================================
// DATABASE & SERVER LIFECYCLE
// =========================================================

const connectDatabase = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is not defined in environment variables");
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log("MongoDB Connected");
};

mongoose.connection.on("connected", () => {
  console.log("Mongoose connection established");
});

mongoose.connection.on("error", (error) => {
  console.error("MongoDB runtime error:", error);
});

mongoose.connection.on("disconnected", () => {
  console.warn("MongoDB disconnected");
});

let serverStarted = false;
let isShuttingDown = false;

const startServer = async () => {
  try {
    await connectDatabase();
    initializeChatSocket(io);

    server.listen(PORT, "0.0.0.0", () => {
      serverStarted = true;
      console.log("==========================================");
      console.log(`Server running on port ${PORT}`);
      console.log(`Health: http://localhost:${PORT}/api/health`);
      console.log("==========================================");
    });
  } catch (error) {
    console.error("Server startup error:", error);
    process.exit(1);
  }
};

startServer();

// =========================================================
// ERROR HANDLERS & SHUTDOWN
// =========================================================

app.use((req, res) => {
  return res.status(404).json({ message: "API route not found" });
});

app.use((error, req, res, next) => {
  console.error("[EXPRESS ERROR]", error);

  if (res.headersSent) {
    return next(error);
  }

  if (error?.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ message: "Profile picture must be 5 MB or smaller." });
  }

  if (error?.name === "MulterError") {
    return res.status(400).json({ message: error.message || "File upload failed." });
  }

  return res.status(error.status || 500).json({
    message: error.message || "Internal server error",
  });
});

const shutdown = async (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`${signal} received. Shutting down...`);

  try {
    io.close();
    console.log("Socket.IO closed");
  } catch (error) {
    console.error("Socket.IO shutdown error:", error);
  }

  if (!serverStarted) {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
    process.exit(0);
    return;
  }

  server.close(async (serverError) => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      console.log("MongoDB connection closed");
    }
    process.exit(serverError ? 1 : 0);
  });
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("unhandledRejection", (reason) => console.error("Unhandled promise rejection:", reason));
process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
  shutdown("uncaughtException");
});