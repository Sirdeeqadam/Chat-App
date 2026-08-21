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

const socketURL =
  import.meta.env.VITE_SOCKET_URL ||
  "http://localhost:5000";

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