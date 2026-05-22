import express from "express";
import {
  getUsers,
  login,
  logout,
  signup,
  verifyOtp,
  getOnlineUsers,
} from "../controllers/auth.controller.js";
import { authenticateToken } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/verify-otp", verifyOtp);
router.post("/login", login);
router.post("/logout", authenticateToken, logout);
router.get("/users", authenticateToken, getUsers);
router.get("/online-users", authenticateToken, getOnlineUsers);

export default router;
