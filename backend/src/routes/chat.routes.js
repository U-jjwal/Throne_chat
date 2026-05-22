import express from "express";
import {
  createPrivateChat,
  createGroupChat,
  getAllChats,
  getSingleChat,
  getOrCreateChat,
} from "../controllers/chat.controller.js";
import { authenticateToken } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(authenticateToken);

router.post("/private", createPrivateChat);
router.post("/group", createGroupChat);
router.get("/", getAllChats);
router.get("/user/:userId", getOrCreateChat); // Must be before /:chatId
router.get("/:chatId", getSingleChat);

export default router;
