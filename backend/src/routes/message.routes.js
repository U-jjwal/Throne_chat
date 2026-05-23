import express from "express";
import { getMessages, sendMessage } from "../controllers/message.controller.js";
import { authenticateToken } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(authenticateToken);

// get messages for a chat
router.get("/:chatId", getMessages);

// send message to a chat
router.post("/", sendMessage);

export default router;
