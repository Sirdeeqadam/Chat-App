import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import api from "../services/api";

const AuthContext = createContext(null);

// =====================================================
// AUTH PROVIDER
// =====================================================

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // ===================================================
  // SAVE USER LOCALLY
  // ===================================================

  const persistUser = useCallback((nextUser) => {
    if (nextUser && typeof nextUser === "object") {
      localStorage.setItem("user", JSON.stringify(nextUser));
    } else {
      localStorage.removeItem("user");
    }
  }, []);

  // ===================================================
  // RESTORE SESSION
  // ===================================================

  useEffect(() => {
    let mounted = true;

    const restoreSession = async () => {
      try {
        const token = localStorage.getItem("token");
        const savedUser = localStorage.getItem("user");

        if (!token) {
          if (mounted) {
            setUser(null);
          }
          return;
        }

        if (savedUser) {
          try {
            const parsedUser = JSON.parse(savedUser);
            if (parsedUser && typeof parsedUser === "object" && mounted) {
              setUser(parsedUser);
            }
          } catch (error) {
            console.error("Failed to restore saved user:", error);
            localStorage.removeItem("user");
          }
        }

        try {
          const response = await api.get("/profile");
          const freshUser = response.data;

          if (mounted && freshUser) {
            setUser((currentUser) => {
              const nextUser = {
                ...(currentUser || {}),
                ...freshUser,
              };
              persistUser(nextUser);
              return nextUser;
            });
          }
        } catch (error) {
          console.warn(
            "Could not refresh profile:",
            error.response?.data?.message || error.message
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    restoreSession();

    return () => {
      mounted = false;
    };
  }, [persistUser]);

  // ===================================================
  // LOGIN
  // ===================================================

  const login = useCallback(
    async (credentials) => {
      const rawIdentifier =
        credentials?.identifier ||
        credentials?.email ||
        credentials?.username ||
        "";

      const identifier = rawIdentifier.trim();
      const password = credentials?.password;

      if (!identifier) {
        throw new Error("Email or username is required.");
      }

      if (!password) {
        throw new Error("Password is required.");
      }

      // Always pass identifier, email, and username in payload
      const loginPayload = {
        identifier,
        email: identifier,
        username: identifier,
        password,
      };

      const response = await api.post("/auth/login", loginPayload);
      const data = response.data;

      if (!data?.token) {
        throw new Error("Login response did not contain a token.");
      }

      if (!data?.user) {
        throw new Error("Login response did not contain user information.");
      }

      const loggedInUser = {
        ...data.user,
        bio: data.user.bio || "",
        profilePicture: data.user.profilePicture || null,
        language: data.user.language || "English",
      };

      localStorage.setItem("token", data.token);
      persistUser(loggedInUser);
      setUser(loggedInUser);

      return {
        ...data,
        user: loggedInUser,
      };
    },
    [persistUser]
  );

  // ===================================================
  // UPDATE USER
  // ===================================================

  const updateUser = useCallback(
    (updatedUser) => {
      if (!updatedUser || typeof updatedUser !== "object") {
        return null;
      }

      let nextUser = null;

      setUser((currentUser) => {
        nextUser = {
          ...(currentUser || {}),
          ...updatedUser,
        };

        persistUser(nextUser);
        return nextUser;
      });

      return nextUser;
    },
    [persistUser]
  );

  // ===================================================
  // REFRESH CURRENT USER
  // ===================================================

  const refreshUser = useCallback(async () => {
    try {
      const response = await api.get("/profile");
      const freshUser = response.data;

      if (!freshUser) {
        return null;
      }

      updateUser(freshUser);
      return freshUser;
    } catch (error) {
      console.error("Failed to refresh current user:", error);
      throw error;
    }
  }, [updateUser]);

  // ===================================================
  // LOGOUT
  // ===================================================

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  }, []);

  // ===================================================
  // CONTEXT VALUE
  // ===================================================

  const value = useMemo(
    () => ({
      user,
      setUser,
      updateUser,
      refreshUser,
      login,
      logout,
      loading,
    }),
    [user, updateUser, refreshUser, login, logout, loading]
  );

  if (loading) {
    return <div className="auth-loading">Loading...</div>;
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// =====================================================
// USE AUTH
// =====================================================

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
};

export default AuthContext;