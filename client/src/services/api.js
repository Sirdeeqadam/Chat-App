import axios from "axios";

// =====================================================
// API BASE URL
// =====================================================
//
// Local:
// http://localhost:5000/api
//
// Production:
// VITE_API_URL=https://your-backend.onrender.com/api
//
// The normalization below prevents accidental:
//
// https://server.com/api/api
// =====================================================

const rawBaseURL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000/api";

const baseURL =
  String(rawBaseURL)
    .trim()
    .replace(/\/+$/, "");

// =====================================================
// AXIOS INSTANCE
// =====================================================

const api = axios.create({
  baseURL,

  timeout: 15000,
});

// =====================================================
// ATTACH JWT
// =====================================================

api.interceptors.request.use(
  (config) => {
    const token =
      localStorage.getItem(
        "token"
      );

    if (token) {
      config.headers =
        config.headers || {};

      config.headers.Authorization =
        `Bearer ${token}`;
    }

    return config;
  },

  (error) => {
    return Promise.reject(
      error
    );
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
    const status =
      error?.response?.status;

    // ---------------------------------------------------
    // AUTHENTICATION ERROR
    // ---------------------------------------------------

    if (status === 401) {
      console.warn(
        "[API] Authentication failed."
      );

      // IMPORTANT:
      //
      // Do not automatically clear the token here.
      // AuthContext is responsible for session state.
    }

    // ---------------------------------------------------
    // SERVER UNAVAILABLE
    // ---------------------------------------------------

    if (
      !error.response &&
      error.request
    ) {
      console.error(
        "[API] Server is unreachable:",
        baseURL
      );
    }

    return Promise.reject(
      error
    );
  }
);

export default api;