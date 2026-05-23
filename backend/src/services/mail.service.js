import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

// gmail smtp config
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// verify mail server is ready
transporter.verify((error, success) => {
  if (error) {
    console.log("Transport Error:", error);
  } else {
    console.log("✅ Mail Server Ready");
  }
});

// send otp email to user
export const sendOtpMail = async (email, otp) => {
  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Verification OTP for Chat App",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Email Verification</h2>
          <p>Your OTP for account verification is:</p>
          <h1 style="color: #4F46E5; font-size: 32px;">${otp}</h1>
          <p>This OTP expires in <strong>5 minutes</strong>.</p>
          <hr />
          <p style="color: #666; font-size: 12px;">If you didn't request this, please ignore this email.</p>
        </div>
      `,
    });
    console.log("Email Sent:", info.messageId);
    return true;
  } catch (error) {
    console.log("Mail Error:", error);
    throw error;
  }
};