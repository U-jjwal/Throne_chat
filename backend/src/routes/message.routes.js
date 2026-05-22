import express from "express";
import { getMessages, sendMessage } from "../controllers/message.controller.js";
import { authenticateToken } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(authenticateToken);
router.get("/:chatId", getMessages);
router.post("/", sendMessage);

export default router;
