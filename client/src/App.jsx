import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import { useAuth } from "./context/AuthContext";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Chat from "./pages/Chat";
import Profile from "./pages/Profile";
import ForgotPassword from "./pages/ForgotPassword";

// =====================================================
// PROTECTED ROUTE
// =====================================================

const ProtectedRoute = ({
  children,
}) => {
  const { user } = useAuth();

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  return children;
};

// =====================================================
// APP
// =====================================================

const App = () => {
  return (
    <BrowserRouter>
      <Routes>

        {/* =============================================
            DEFAULT
        ============================================= */}

        <Route
          path="/"
          element={
            <Navigate
              to="/login"
              replace
            />
          }
        />

        {/* =============================================
            LOGIN
        ============================================= */}

        <Route
          path="/login"
          element={<Login />}
        />

        {/* =============================================
            REGISTER
        ============================================= */}

        <Route
          path="/register"
          element={<Register />}
        />

        <Route
          path="/forgot-password"
          element={<ForgotPassword />}
        />

        <Route
          path="/reset-password"
          element={
            <Navigate
              to="/forgot-password"
              replace
            />
          }
        />

        {/* =============================================
            CHAT
        ============================================= */}

        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              <Chat />
            </ProtectedRoute>
          }
        />

        {/* =============================================
            PROFILE
        ============================================= */}

        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />

        {/* =============================================
            UNKNOWN ROUTES
        ============================================= */}

        <Route
          path="*"
          element={
            <Navigate
              to="/chat"
              replace
            />
          }
        />

      </Routes>
    </BrowserRouter>
  );
};

export default App;