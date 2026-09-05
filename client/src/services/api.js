import axios from "axios";

// =====================================================
// API BASE URL
// =====================================================

const defaultBaseURL = import.meta.env.PROD
  ? "https://chat-app-k29o.onrender.com/api"
  : "http://localhost:5000/api";

const rawBaseURL = import.meta.env.VITE_API_URL || defaultBaseURL;

const baseURL =
  String(rawBaseURL)
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/api\/?$/, "") + "/api";

// =====================================================
// AXIOS INSTANCE
// =====================================================

const api = axios.create({
  baseURL,
  // Increased from 15s to 60s to prevent timeouts during Render free-tier cold starts
  timeout: 60000,
});

if (import.meta.env.PROD && !import.meta.env.VITE_API_URL) {
  console.error(
    "[API] VITE_API_URL is missing in the deployed frontend environment."
  );
}

// =====================================================
// ATTACH JWT
// =====================================================

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");

    if (token) {
      if (config.headers?.set) {
        config.headers.set("Authorization", `Bearer ${token}`);
      } else {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// =====================================================
// RESPONSE INTERCEPTOR
// =====================================================

api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    const status = error?.response?.status;

    // ---------------------------------------------------
    // AUTHENTICATION ERROR
    // ---------------------------------------------------

    if (status === 401) {
      console.warn("[API] Authentication failed.");
      // Handled by AuthContext session management
    }

    // ---------------------------------------------------
    // SERVER UNAVAILABLE / TIMEOUT / NETWORK ERROR
    // ---------------------------------------------------

    if (!error.response && error.request) {
      console.error("[API] Server is unreachable or timed out:", baseURL);
    }

    return Promise.reject(error);
  }
);

export default api;