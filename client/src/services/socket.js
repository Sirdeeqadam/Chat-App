import { io } from "socket.io-client";

// =====================================================
// SOCKET SERVER URL
// =====================================================
//
// Local fallback:
// http://localhost:5000
//
// Production:
// Set VITE_SOCKET_URL.
// =====================================================

const configuredSocketURL = String(import.meta.env.VITE_SOCKET_URL || "").trim();
const socketURL = import.meta.env.PROD && /localhost|127\.0\.0\.1/i.test(configuredSocketURL)
  ? "https://chat-app-k29o.onrender.com"
  : configuredSocketURL || "http://localhost:5000";

const socket = io(
  socketURL,
  {
    autoConnect: false,

    transports: [
      "websocket",
      "polling",
    ],

    reconnection: true,

    reconnectionAttempts: 10,

    reconnectionDelay: 1000,

    reconnectionDelayMax:
      5000,
  }
);

export default socket;