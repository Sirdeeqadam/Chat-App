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
const defaultSocketURL = import.meta.env.PROD
  ? "https://chat-app-k29o.onrender.com"
  : "http://localhost:5000";
const socketURL = import.meta.env.PROD && /localhost|127\.0\.0\.1/i.test(configuredSocketURL)
  ? defaultSocketURL
  : configuredSocketURL || defaultSocketURL;

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