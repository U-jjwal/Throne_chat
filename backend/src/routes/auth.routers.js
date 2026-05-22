import express from 'express';
import { login, logout, signup, verifyOtp } from '../controllers/auth.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.route("/signup").post(signup);

router.route("/verify-otp").post(verifyOtp);

router.route("/login").post(login)

router.route('/logout').post(authenticateToken,logout)

export default router;