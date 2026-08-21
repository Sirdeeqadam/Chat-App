import {
  useState,
} from "react";

import {
  Link,
  useNavigate,
} from "react-router-dom";

import {
  useAuth,
} from "../context/AuthContext";

const Login = () => {
  const navigate =
    useNavigate();

  const {
    login,
  } = useAuth();

  const [
    formData,
    setFormData,
  ] = useState({
    email: "",
    password: "",
  });

  const [
    error,
    setError,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(false);

  // =====================================================
  // HANDLE INPUT
  // =====================================================

  const handleChange = (
    event
  ) => {
    const {
      name,
      value,
    } = event.target;

    setFormData(
      (previous) => ({
        ...previous,
        [name]: value,
      })
    );
  };

  // =====================================================
  // LOGIN
  // =====================================================

  const handleSubmit =
    async (event) => {
      event.preventDefault();

      setError("");

      const email =
        formData.email.trim();

      const password =
        formData.password;

      if (!email) {
        setError(
          "Please enter your email or username."
        );

        return;
      }

      if (!password) {
        setError(
          "Please enter your password."
        );

        return;
      }

      try {
        setLoading(true);

        // AuthContext.login handles:
        // - API request
        // - token storage
        // - user storage
        // - updating AuthContext
        await login({
          email,
          password,
        });

        navigate(
          "/chat",
          {
            replace: true,
          }
        );
      } catch (loginError) {
        console.error(
          "Login error:",
          loginError
        );

        setError(
          loginError.response
            ?.data
            ?.message ||
            loginError.message ||
            "Login failed. Please check your credentials."
        );
      } finally {
        setLoading(false);
      }
    };

  return (
    <div className="auth-container">

      <form
        className="auth-form"
        onSubmit={
          handleSubmit
        }
      >

        <h1>
          Welcome Back
        </h1>

        {error && (
          <p className="error">
            {error}
          </p>
        )}

        {/* =================================================
            EMAIL / USERNAME
        ================================================== */}

        <input
          type="text"
          name="email"
          placeholder="Email or username"
          value={
            formData.email
          }
          onChange={
            handleChange
          }
          autoComplete="username"
          disabled={loading}
          required
        />

        {/* =================================================
            PASSWORD
        ================================================== */}

        <input
          type="password"
          name="password"
          placeholder="Password"
          value={
            formData.password
          }
          onChange={
            handleChange
          }
          autoComplete="current-password"
          disabled={loading}
          required
        />

        {/* =================================================
            LOGIN BUTTON
        ================================================== */}

        <button
          type="submit"
          disabled={
            loading
          }
        >
          {loading
            ? "Logging in..."
            : "Login"}
        </button>

        <Link
          to="/forgot-password"
          className="forgot-password-link"
        >
          Forgot password?
        </Link>

        {/* =================================================
            REGISTER
        ================================================== */}

        <p>
          Don't have an account?{" "}
          <Link to="/register">
            Register
          </Link>
        </p>

      </form>

    </div>
  );
};

export default Login;
