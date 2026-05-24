import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useState, useEffect } from "react";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import VerifyOtp from "./pages/VerifyOtp";
import Chat from "./pages/Chat";

function App() {
  const [token, setToken] = useState(localStorage.getItem("token"));

  // Listen for changes in localStorage
  useEffect(() => {
    const handleStorageChange = () => {
      setToken(localStorage.getItem("token"));
    };

    // Listen for custom event
    window.addEventListener("storage", handleStorageChange);
    
    // Also listen for manual token changes
    const originalSetItem = localStorage.setItem;
    localStorage.setItem = function(key, value) {
      originalSetItem.apply(this, arguments);
      if (key === "token") {
        window.dispatchEvent(new Event("storage"));
      }
    };

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      localStorage.setItem = originalSetItem;
    };
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={token ? <Navigate to="/chat" /> : <Navigate to="/login" />} />
        <Route path="/login" element={token ? <Navigate to="/chat" /> : <Login />} />
        <Route path="/signup" element={token ? <Navigate to="/chat" /> : <Signup />} />
        <Route path="/verify-otp" element={<VerifyOtp />} />
        <Route path="/chat" element={token ? <Chat /> : <Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;