import dotenv from "dotenv";
dotenv.config();
import { User } from "../models/user.model.js";
import { generateOtp } from "../utils/generateOtp.js";
import { redis } from "../db/redis.js";
import { sendOtpMail } from "../services/mail.service.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

// signup user
export const signup = async (req, res) => {
  try {
    const { fullName, email, password } = req.body;

    if (!fullName || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters long" });
    }

    // check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists with this email" });
    }

    // generate otp and hash password
    const otp = generateOtp();
    const hashedPassword = await bcrypt.hash(password, 10);

    // store signup data in redis for 5 min
    await redis.setex(
      `signup:${email}`,
      300,
      JSON.stringify({ fullName, email, password: hashedPassword, otp })
    );

    // send otp to email
    await sendOtpMail(email, otp);

    return res.status(200).json({
      success: true,
      message: "OTP sent to email successfully",
      email,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// verify otp and create account
export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    // get signup data from redis
    const userData = await redis.get(`signup:${email}`);
    if (!userData) {
      return res.status(400).json({ message: "OTP expired or invalid" });
    }

    // match otp
    const parsedData = JSON.parse(userData);
    if (parsedData.otp !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    // create new user in db
    const newUser = await User.create({
      fullName: parsedData.fullName,
      email: parsedData.email,
      password: parsedData.password,
    });

    // generate jwt token
    const token = jwt.sign(
      { userId: newUser._id, email: newUser.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // set cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    newUser.password = undefined;
    return res.status(201).json({
      success: true,
      message: "Account created successfully",
      user: newUser,
      token,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

// login user
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // generate jwt token
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // set cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // update online status
    await User.findByIdAndUpdate(user._id, { lastSeen: new Date(), isOnline: true });

    user.password = undefined;
    return res.status(200).json({
      success: true,
      message: "Login successful",
      user,
      token,
    });
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error while login" });
  }
};

// logout user
export const logout = async (req, res) => {
  try {
    // set user offline and clean up redis
    if (req.user?.id) {
      await User.findByIdAndUpdate(req.user.id, { isOnline: false, lastSeen: new Date() });
      await redis.del(`socket:${req.user.id}`);
      await redis.srem("online_users", req.user.id);
    }
    res.clearCookie("token");
    return res.status(200).json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error while logout" });
  }
};

// get all users
export const getUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password");
    return res.status(200).json({
      success: true,
      users,
    });
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

// get online users from redis
export const getOnlineUsers = async (req, res) => {
  try {
    const onlineUserIds = await redis.smembers("online_users");
    const onlineUsers = await User.find({ _id: { $in: onlineUserIds } }).select("-password");
    return res.status(200).json({
      success: true,
      onlineUsers,
    });
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error" });
  }
};