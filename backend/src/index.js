import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import connectDb from "./db/index.js";
import { redis } from "./db/redis.js";
import { initializeSocket } from "./socket/socket.js";

dotenv.config();



const app = express();
const server = http.createServer(app);


const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  },
});


app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());


connectDb();


redis.ping().then(() => console.log("✅ Redis connected")).catch(console.error);

import authRoutes from "./routes/auth.routes.js";
import chatRoutes from "./routes/chat.routes.js";
import messageRoutes from "./routes/message.routes.js";
import uploadRoutes from "./routes/upload.routes.js";

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/chats", chatRoutes);
app.use("/api/v1/messages", messageRoutes);
app.use("/api/v1/upload", uploadRoutes);


app.get("/api/v1/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date() });
});

initializeSocket(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
