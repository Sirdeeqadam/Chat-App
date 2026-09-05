import { useState, useEffect } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import api from "../services/api";

const VerifyOtp = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState(location.state?.email || "");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (location.state?.devOtp) {
      setMessage(`Development OTP: ${location.state.devOtp}`);
    }
  }, [location.state]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!email.trim()) {
      setError("Email address is required.");
      return;
    }

    if (!/^\d{6}$/.test(otp)) {
      setError("Please enter a valid 6-digit code.");
      return;
    }

    try {
      setLoading(true);
      const response = await api.post("/auth/verify-email", {
        email: email.trim(),
        otp: otp.trim(),
      });

      setMessage(response.data?.message || "Email verified successfully!");

      setTimeout(() => {
        navigate("/login", { replace: true });
      }, 1500);
    } catch (err) {
      setError(
        err.response?.data?.message || "Verification failed. Invalid or expired OTP."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    setMessage("");

    if (!email.trim()) {
      setError("Email address is required.");
      return;
    }

    try {
      setLoading(true);
      const response = await api.post("/auth/resend-otp", {
        email: email.trim(),
      });
      const developmentOtp = response.data?.otp;
      setMessage(
        developmentOtp
          ? `A new OTP was sent. Development OTP: ${developmentOtp}`
          : response.data?.message || "A new OTP was sent to your email."
      );
    } catch (err) {
      setError(err.response?.data?.message || "Unable to resend the OTP.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <form className="auth-form" onSubmit={handleSubmit}>
        <h1>Verify Email</h1>
        <p className="auth-help">
          Enter the 6-digit code sent to your email to verify your account.
        </p>

        {error && <p className="error">{error}</p>}
        {message && <p className="success">{message}</p>}

        <input
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading}
        />

        <input
          type="text"
          placeholder="6-Digit OTP"
          value={otp}
          onChange={(e) =>
            setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
          }
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          disabled={loading}
        />

        <button type="submit" disabled={loading}>
          {loading ? "Verifying..." : "Verify OTP"}
        </button>

        <button
          type="button"
          className="auth-secondary-button"
          onClick={handleResend}
          disabled={loading}
        >
          Resend OTP
        </button>

        <p>
          Already verified? <Link to="/login">Login</Link>
        </p>
      </form>
    </div>
  );
};

export default VerifyOtp;