import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../services/api";
import "./Auth.css";

function VerifyOtp() {
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email;
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!email) {
    navigate("/signup");
    return null;
  }

  const handleVerify = async () => {
    if (otp.length !== 6) {
      setError("Please enter 6-digit OTP");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await api.post("/auth/verify-otp", { email, otp });
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));
      
      // Force hard navigation
      window.location.href = "/chat";
    } catch (err) {
      setError(err.response?.data?.message || "Verification failed");
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>Verify OTP</h1>
        <p>Enter the 6-digit code sent to {email}</p>

        {error && <div className="error-message">{error}</div>}

        <input
          type="text"
          placeholder="Enter OTP"
          value={otp}
          onChange={(e) => setOtp(e.target.value.slice(0, 6))}
          maxLength={6}
        />

        <button onClick={handleVerify} disabled={loading}>
          {loading ? "Verifying..." : "Verify"}
        </button>

        <p className="auth-link">
          <button
            onClick={() => navigate("/signup")}
            className="link-button"
          >
            Back to Signup
          </button>
        </p>
      </div>
    </div>
  );
}

export default VerifyOtp;