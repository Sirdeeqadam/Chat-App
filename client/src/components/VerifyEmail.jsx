import React, { useState } from "react";
import api from "../services/api";

const VerifyEmail = ({ email = "digitalsirdeeq@gmail.com" }) => {
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleVerify = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const response = await api.post("/auth/verify-email", { email, otp });
      const data = response.data;

      setMessage("Email verified successfully! You can now log in.");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "400px", margin: "50px auto", padding: "20px" }}>
      <h2>Verify Your Email</h2>
      <p>Enter the code sent to <strong>{email}</strong></p>

      {message && <p style={{ color: "green" }}>{message}</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      <form onSubmit={handleVerify}>
        <div style={{ marginBottom: "15px" }}>
          <input
            type="text"
            placeholder="Enter OTP Code"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            required
            style={{ width: "100%", padding: "10px", fontSize: "16px" }}
          />
        </div>

        <button
          type="submit"
          disabled={loading || !otp}
          style={{ width: "100%", padding: "10px", fontSize: "16px", cursor: "pointer" }}
        >
          {loading ? "Verifying..." : "Verify OTP"}
        </button>
      </form>
    </div>
  );
};

export default VerifyEmail;