import nodemailer from "nodemailer";

// 1. Direct HTTP API send using Brevo (completely bypasses Railway SMTP block!)
const sendViaBrevoAPI = async (email, otp) => {
    const apiKey = process.env.BREVO_API_KEY;
    const senderEmail = process.env.BREVO_SENDER_EMAIL || "laptopplapii@gmail.com";
    if (!apiKey) return false;

    try {
        const response = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: {
                "accept": "application/json",
                "api-key": apiKey,
                "content-type": "application/json",
            },
            body: JSON.stringify({
                sender: {
                    name: "Throne Chat",
                    email: senderEmail,
                },
                to: [
                    {
                        email: email,
                    },
                ],
                subject: "Throne Chat OTP",
                htmlContent: `
                    <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e5e5ea; border-radius: 8px; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #333; text-align: center;">Throne Chat Verification</h2>
                        <p>Welcome to Throne Chat! Your account verification OTP is:</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <h1 style="color: #6362E8; font-size: 36px; letter-spacing: 4px; display: inline-block; padding: 10px 20px; background: rgba(99,98,232,0.1); border-radius: 6px;">${otp}</h1>
                        </div>
                        <p>This OTP will expire in <strong>5 minutes</strong>.</p>
                        <hr style="border: none; border-top: 1px solid #e5e5ea;" />
                        <p style="color: #8e8e93; font-size: 12px; text-align: center;">If you didn't request this verification, you can safely ignore this email.</p>
                    </div>
                `,
            }),
        });

        if (response.ok) {
            const data = await response.json();
            console.log(`✅ Email Sent via Brevo HTTP API! (Live OTP generated: ${otp})`, data.messageId);
            return true;
        }
        const errData = await response.json();
        console.log("❌ Brevo API returned error:", errData);
        return false;
    } catch (err) {
        console.log("❌ Brevo API connection error:", err.message);
        return false;
    }
};

// 2. SMTP Transporter config as a secure secondary fallback
export const transporter = nodemailer.createTransport({
    host: "smtp-relay.brevo.com",
    port: 465,
    secure: true, // true for port 465 (SSL)
    auth: {
        user: process.env.BREVO_EMAIL,
        pass: process.env.BREVO_SMTP_KEY,
    },
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 5000,
});

transporter.verify((error) => {
    if (error) {
        console.log("❌ SMTP verify skipped or failed (will use HTTP API fallback).");
    } else {
        console.log("✅ SMTP Relay Server Ready");
    }
});

export const sendOtpMail = async (email, otp) => {
    // Attempt 1: Try sending via Brevo HTTP API (Port 443 - 100% bypasses Railway blocks!)
    const sentViaAPI = await sendViaBrevoAPI(email, otp);
    if (sentViaAPI) return true;

    // Attempt 2: Fallback to standard Brevo SMTP relay
    if (process.env.BREVO_EMAIL && process.env.BREVO_SMTP_KEY) {
        try {
            await transporter.sendMail({
                from: process.env.BREVO_SENDER_EMAIL || "laptopplapii@gmail.com",
                to: email,
                subject: "Throne Chat OTP",
                html: `
                    <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e5e5ea; border-radius: 8px; max-width: 600px; margin: 0 auto;">
                        <h2>Email Verification</h2>
                        <p>Your OTP:</p>
                        <h1>${otp}</h1>
                        <p>OTP expires in 5 minutes.</p>
                    </div>
                `,
            });
            console.log(`✅ OTP Email Sent via SMTP! (Live OTP generated: ${otp})`);
            return true;
        } catch (error) {
            console.log("❌ Mail SMTP Error:", error.message);
        }
    }

    // Attempt 3: Local sandbox fallback print
    console.log("🔑 [TEST ONLY] Live OTP generated for register:", otp);
    return true;
};