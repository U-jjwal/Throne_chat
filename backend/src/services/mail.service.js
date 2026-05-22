import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const transporter = nodemailer.createTransport({

    service: "gmail",

    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

transporter.verify((error, success) => {

    if (error) {

        console.log("Transport Error:", error);

    } else {

        console.log("Mail Server Ready");
    }
});

export const sendOtpMail = async (email, otp) => {

    try {

        const info = await transporter.sendMail({

            from: process.env.EMAIL_USER,

            to: email,

            subject: "Verification OTP for Throne Chat",

            html: `
                <h2>Email Verification For Throne Chat</h2>

                <p>Your OTP is:</p>

                <h1>${otp}</h1>

                <p>This OTP expires in 5 minutes.</p>
            `,
        });

        console.log("Email Sent:", info.response);

    } catch (error) {

        console.log("Mail Error:", error);
    }
};