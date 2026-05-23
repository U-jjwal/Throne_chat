import express from "express";
import {
  createPrivateChat,
  createGroupChat,
  getAllChats,
  getSingleChat,
  getOrCreateChat,
  addMemberToGroup,
  removeMemberFromGroup,
  makeGroupAdmin,
} from "../controllers/chat.controller.js";
import { authenticateToken } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(authenticateToken);

// private chat routes
router.post("/private", createPrivateChat);
router.get("/user/:userId", getOrCreateChat);

// group chat routes
router.post("/group", createGroupChat);
router.post("/group/add-member", addMemberToGroup);
router.post("/group/remove-member", removeMemberFromGroup);
router.post("/group/make-admin", makeGroupAdmin);

// general routes
router.get("/", getAllChats);
router.get("/:chatId", getSingleChat);

export default router;
