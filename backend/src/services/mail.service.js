import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
    service: "gmail",

    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

export const sendOtpMail = async (email, otp) => {

    await transporter.sendMail({
        from: process.env.EMAIL_USER,

        to: email,

        subject: "Verification OTP for Throne Chat",

        html: `
            <h2>Email Verification</h2>

            <p>Your OTP is:</p>

            <h1>${otp}</h1>

            <p>This OTP expires in 5 minutes.</p>
        `,
    });

};