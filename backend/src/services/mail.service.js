import nodemailer from "nodemailer";

export const transporter = nodemailer.createTransport({
    host: "smtp-relay.brevo.com",
    port: 587,
    secure: false,
    auth: {
        user: process.env.BREVO_EMAIL,
        pass: process.env.BREVO_SMTP_KEY,
    },
    connectionTimeout: 5000, // 5 seconds connection timeout
    greetingTimeout: 5000,
    socketTimeout: 5000,
});

transporter.verify((error) => {
    if (error) {
        console.log("❌ SMTP Error:", error.message);
    } else {
        console.log("✅ Mail Server Ready");
    }
});

export const sendOtpMail = async (email, otp) => {
    try {
        await transporter.sendMail({
            from: process.env.BREVO_EMAIL,
            to: email,
            subject: "Throne Chat OTP",
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e5e5ea; border-radius: 8px; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333;">Email Verification</h2>
                    <p>Welcome to Throne Chat! Your account verification OTP is:</p>
                    <h1 style="color: #6362E8; font-size: 32px; letter-spacing: 2px;">${otp}</h1>
                    <p>This OTP will expire in <strong>5 minutes</strong>.</p>
                    <hr style="border: none; border-top: 1px solid #e5e5ea;" />
                    <p style="color: #8e8e93; font-size: 12px;">If you didn't request this, you can safely ignore this email.</p>
                </div>
            `,
        });
        console.log("✅ OTP Email Sent");
    } catch (error) {
        console.log("❌ Mail Error:", error.message);
        console.log("🔑 [TEST ONLY] Live OTP generated for register:", otp);
    }
};