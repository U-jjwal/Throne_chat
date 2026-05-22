import { GroupChat } from "../models/groupChat.model.js";
import { User } from "../models/user.model.js";

const populateChat = (query) =>
  query
    .populate("participants", "-password")
    .populate("groupadmin", "-password")
    .populate({
      path: "latestMessage",
      populate: { path: "senderId", select: "fullName avatar" },
    });

export const createPrivateChat = async (req, res) => {
  try {
    const { userId } = req.body;
    const currentUserId = req.user.id;

    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }
    if (userId === currentUserId) {
      return res.status(400).json({ message: "Cannot create a chat with yourself" });
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if chat already exists
    let chat = await populateChat(
      GroupChat.findOne({
        isGroupChat: false,
        participants: { $all: [currentUserId, userId], $size: 2 },
      })
    );

    if (chat) {
      return res.status(200).json({ success: true, chat });
    }

    // Create new private chat
    const newChat = await GroupChat.create({
      isGroupChat: false,
      participants: [currentUserId, userId],
    });

    chat = await populateChat(GroupChat.findById(newChat._id));
    res.status(201).json({ success: true, chat });
  } catch (error) {
    console.error("createPrivateChat error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

export const createGroupChat = async (req, res) => {
  try {
    const { groupName, participants } = req.body;
    const currentUserId = req.user.id;

    if (!groupName?.trim()) {
      return res.status(400).json({ message: "Group name is required" });
    }
    if (!Array.isArray(participants) || participants.length < 2) {
      return res.status(400).json({ message: "At least 2 participants are required" });
    }

    const allParticipants = [...new Set([...participants, currentUserId])];

    const newChat = await GroupChat.create({
      isGroupChat: true,
      groupName: groupName.trim(),
      participants: allParticipants,
      groupadmin: currentUserId,
    });

    const chat = await populateChat(GroupChat.findById(newChat._id));
    res.status(201).json({ success: true, chat });
  } catch (error) {
    console.error("createGroupChat error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

export const getAllChats = async (req, res) => {
  try {
    const chats = await populateChat(
      GroupChat.find({ participants: req.user.id })
    ).sort({ updatedAt: -1 });
    res.status(200).json({ success: true, count: chats.length, chats });
  } catch (error) {
    console.error("getAllChats error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

export const getSingleChat = async (req, res) => {
  try {
    const chat = await populateChat(GroupChat.findById(req.params.chatId));
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }
    const isMember = chat.participants.some((p) => p._id.toString() === req.user.id);
    if (!isMember) {
      return res.status(403).json({ message: "Not authorized to view this chat" });
    }
    res.status(200).json({ success: true, chat });
  } catch (error) {
    console.error("getSingleChat error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

// Get or create a chat with a user
export const getOrCreateChat = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.id;

    if (userId === currentUserId) {
      return res.status(400).json({ message: "Cannot chat with yourself" });
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Find existing chat
    let chat = await populateChat(
      GroupChat.findOne({
        isGroupChat: false,
        participants: { $all: [currentUserId, userId], $size: 2 },
      })
    );

    // If not exists, create new one
    if (!chat) {
      const newChat = await GroupChat.create({
        isGroupChat: false,
        participants: [currentUserId, userId],
      });
      chat = await populateChat(GroupChat.findById(newChat._id));
    }

    res.status(200).json({ success: true, chat });
  } catch (error) {
    console.error("getOrCreateChat error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};
