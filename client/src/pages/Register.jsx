import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";
import {
  isStrongPassword,
  passwordRequirementsMessage,
} from "../services/passwordValidation";

const Register = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    language: "English",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!isStrongPassword(formData.password)) {
      setError(passwordRequirementsMessage);
      return;
    }

    try {
      setLoading(true);
      const response = await api.post("/auth/register", formData);

      navigate("/verify-otp", {
        state: {
          email: formData.email.trim(),
          devOtp: response.data?.otp || null,
        },
      });
    } catch (err) {
      if (err.response?.data?.email) {
        navigate("/verify-otp", {
          state: { email: err.response.data.email },
        });
        return;
      }

      setError(
        err.response?.data?.message || "Registration failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <form className="auth-form" onSubmit={handleSubmit}>
        <h1>Create Account</h1>

        {error && <p className="error">{error}</p>}

        <input
          type="text"
          name="username"
          placeholder="Username"
          value={formData.username}
          onChange={handleChange}
          required
          disabled={loading}
        />

        <input
          type="email"
          name="email"
          placeholder="Email"
          value={formData.email}
          onChange={handleChange}
          required
          disabled={loading}
        />

        <input
          type="password"
          name="password"
          placeholder="e.g. Chat@2026"
          value={formData.password}
          onChange={handleChange}
          required
          minLength={6}
          disabled={loading}
        />

        <select
          name="language"
          value={formData.language}
          onChange={handleChange}
          disabled={loading}
        >
          <option value="English">English</option>
          <option value="Hausa">Hausa</option>
          <option value="French">French</option>
          <option value="Arabic">Arabic</option>
        </select>

        <button type="submit" disabled={loading}>
          {loading ? "Registering..." : "Register"}
        </button>

        <p>
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </form>
    </div>
  );
};

export default Register;