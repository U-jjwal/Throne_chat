import { User } from "../models/user.model.js";
import { generateOtp } from "../utils/generateOtp.js";
import { redis } from "../db/redis.js";
import { sendOtpMail } from "../services/mail.service.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken"; 
import cookieParser from "cookie-parser";


export const signup = async (req, res) => {

    try{
        
        const { fullName, email, password } =  req.body;

        

        if(!fullName || !email || !password) {
            return res.status(400).json({ message: "All fields are required" });
        }

        if(password.length <= 6) {
            return res.status(400).json({message: "Password must be at least 6 characters long"})
        }

        const existingUser = await User.findOne({ email });

        if(existingUser) {
            return res.status(400).json({ message: "User already exists with this email" });
        }

        const otp =  generateOtp();

        const hashedPassword = await bcrypt.hash(password, 10);

        await redis.setex( 
            `signup:${email}`,
            300,
            JSON.stringify({ fullName, email, password: hashedPassword, otp })
        )
        
        await sendOtpMail(email, otp);
        console.log("check")
        

        return res.status(200).json({ 
            success: true,
            message: "OTP send to email successfully",
            email,
        })

        
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error"});
    }
    
    
}

export const verifyOtp = async (req, res) => {

    try {

        const { email, otp } = req.body;

     

        const userData = await redis.get(
            `signup:${email}`
        );

    

        if (!userData) {

            return res.status(400).json({
                message: "OTP expired or invalid",
            });
        }

   

        const parsedData = JSON.parse(userData);

     

        if (parsedData.otp !== otp) {

            return res.status(400).json({
                message: "Invalid OTP",
            });
        }


        const newUser = await User.create({
            fullName: parsedData.fullName,
            email: parsedData.email,
            password: parsedData.password,
        });

        const token = jwt.sign({ 
            email,
        }, process.env.JWT_SECRET, { expiresIn: "1h" });
        
        res.cookie("token", token)

        
        await redis.del(`signup:${email}`);

        return res.status(201).json({
            success: true,
            message: "Account created successfully",
            user: newUser,
            token,
        });

    } catch (error) {

        console.log(error);

        return res.status(500).json({
            message: "Internal Server Error",
        });
    }
};