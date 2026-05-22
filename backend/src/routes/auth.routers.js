import express from 'express';
import { signup, verifyOtp } from '../controllers/auth.controller.js';

const router = express.Router();

router.route("/signup").post(signup);

router.route("/verify-otp").post(verifyOtp);

export default router;