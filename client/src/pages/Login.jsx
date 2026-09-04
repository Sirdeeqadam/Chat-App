import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    const rawInput = formData.email.trim();
    const password = formData.password;

    if (!rawInput || !password) {
      setError("Please fill in both fields.");
      return;
    }

    try {
      setLoading(true);
      await login({
        identifier: rawInput,
        email: rawInput,
        username: rawInput,
        password,
      });

      navigate("/chat", { replace: true });
    } catch (loginError) {
      console.error("Login error:", loginError);

      if (loginError.response?.status === 403 && loginError.response?.data?.unverified) {
        navigate("/verify-otp", {
          state: { email: loginError.response.data.email },
        });
        return;
      }

      setError(
        loginError.response?.data?.message ||
          loginError.message ||
          "Login failed. Please check your credentials."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <form className="auth-form" onSubmit={handleSubmit}>
        <h1>Welcome Back</h1>

        {error && <p className="error">{error}</p>}

        <input
          type="text"
          name="email"
          placeholder="Email or username"
          value={formData.email}
          onChange={handleChange}
          autoComplete="username"
          disabled={loading}
          required
        />

        <input
          type="password"
          name="password"
          placeholder="Password"
          value={formData.password}
          onChange={handleChange}
          autoComplete="current-password"
          disabled={loading}
          required
        />

        <button type="submit" disabled={loading}>
          {loading ? "Logging in..." : "Login"}
        </button>

        <Link to="/forgot-password" className="forgot-password-link">
          Forgot password?
        </Link>

        <p>
          Don't have an account? <Link to="/register">Register</Link>
        </p>
      </form>
    </div>
  );
};

export default Login;