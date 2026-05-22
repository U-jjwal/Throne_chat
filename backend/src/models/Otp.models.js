import mongoose from 'mongoose';

const otpSchema = new mongoose.Schema({
    email: String,
    otp: String,
    expiresAt: Date,
})

export const Otp = mongoose.model("Otp", otpSchema);