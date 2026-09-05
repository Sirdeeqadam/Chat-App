import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [step, setStep] = useState("request");
  const [message, setMessage] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const requestOtp = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    try {
      setLoading(true);
      const response = await api.post("/auth/forgot-password", {
        email: email.trim(),
      });
      setMessage(response.data?.message || "Check your email for the OTP.");
      setDevOtp(response.data?.otp || "");
      setStep("reset");
    } catch (requestError) {
      console.error("[FORGOT PASSWORD REQUEST ERROR]", requestError.response || requestError);

      if (!requestError.response) {
        setError("Network Error: Unable to reach the backend server. Please verify your API URL.");
      } else {
        setError(
          requestError.response?.data?.message ||
            `Server error (${requestError.response.status}): Unable to request a password reset.`
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!/^\d{6}$/.test(otp)) {
      setError("Enter the 6-digit OTP.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);
      const response = await api.post("/auth/reset-password", {
        email: email.trim(),
        otp,
        password,
      });
      setMessage(response.data?.message || "Password reset successfully.");
      setPassword("");
      setConfirmPassword("");
      setOtp("");
      setDevOtp("");
      setTimeout(() => navigate("/login", { replace: true }), 1200);
    } catch (resetError) {
      console.error("[RESET PASSWORD ERROR]", resetError.response || resetError);

      if (!resetError.response) {
        setError("Network Error: Unable to reach the backend server.");
      } else {
        setError(
          resetError.response?.data?.message ||
            `Server error (${resetError.response.status}): Unable to reset your password.`
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <form
        className="auth-form"
        onSubmit={step === "request" ? requestOtp : resetPassword}
      >
        <h1>{step === "request" ? "Forgot Password" : "Enter OTP"}</h1>
        <p className="auth-help">
          {step === "request"
            ? "Enter your account email to receive a verification code."
            : "Enter the code sent to your email and choose a new password."}
        </p>

        {error && <p className="error">{error}</p>}
        {message && <p className="success">{message}</p>}

        <input
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          disabled={loading || step === "reset"}
          required
        />

        {step === "reset" && (
          <>
            <input
              type="text"
              placeholder="6-digit OTP"
              value={otp}
              onChange={(event) =>
                setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
              inputMode="numeric"
              autoComplete="one-time-code"
              disabled={loading}
              required
            />

            <input
              type="password"
              placeholder="New password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              disabled={loading}
              required
            />

            <input
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              disabled={loading}
              required
            />

            {devOtp && (
              <p className="otp-preview">
                Local development OTP: <strong>{devOtp}</strong>
              </p>
            )}
          </>
        )}

        <button type="submit" disabled={loading}>
          {loading
            ? "Please wait..."
            : step === "request"
              ? "Send OTP"
              : "Reset password"}
        </button>

        {step === "reset" && (
          <button
            type="button"
            className="auth-secondary-button"
            onClick={() => {
              setStep("request");
              setError("");
              setMessage("");
              setDevOtp("");
            }}
          >
            Use another email
          </button>
        )}

        <p>
          Remembered your password? <Link to="/login">Back to login</Link>
        </p>
      </form>
    </div>
  );
};

export default ForgotPassword;