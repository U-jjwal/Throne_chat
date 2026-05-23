import { GroupChat } from "../models/groupChat.model.js";
import { User } from "../models/user.model.js";

// populate chat with participants, admin and latest message
const populateChat = (query) =>
  query
    .populate("participants", "-password")
    .populate("groupadmin", "-password")
    .populate({
      path: "latestMessage",
      populate: { path: "senderId", select: "fullName avatar" },
    });

// create 1-on-1 private chat
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

    // check if target user exists
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // check if chat already exists between these 2 users
    let chat = await populateChat(
      GroupChat.findOne({
        isGroupChat: false,
        participants: { $all: [currentUserId, userId], $size: 2 },
      })
    );

    if (chat) {
      return res.status(200).json({ success: true, chat });
    }

    // create new chat
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

// create group chat
export const createGroupChat = async (req, res) => {
  try {
    const { groupName, participants, groupAvatar } = req.body;
    const currentUserId = req.user.id;

    if (!groupName?.trim()) {
      return res.status(400).json({ message: "Group name is required" });
    }

    if (!Array.isArray(participants) || participants.length < 2) {
      return res.status(400).json({ message: "At least 2 participants are required" });
    }

    // remove duplicates and include creator
    const allParticipants = [...new Set([...participants, currentUserId])];

    const newChat = await GroupChat.create({
      isGroupChat: true,
      groupName: groupName.trim(),
      participants: allParticipants,
      groupadmin: currentUserId,
      groupAvatar: groupAvatar || null,
    });

    const chat = await populateChat(GroupChat.findById(newChat._id));
    res.status(201).json({ success: true, chat });
  } catch (error) {
    console.error("createGroupChat error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

// add member to group (admin only)
export const addMemberToGroup = async (req, res) => {
  try {
    const { chatId, userId } = req.body;
    const currentUserId = req.user.id;

    const chat = await GroupChat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    if (!chat.isGroupChat) {
      return res.status(400).json({ message: "Not a group chat" });
    }

    // only admin can add
    if (chat.groupadmin.toString() !== currentUserId) {
      return res.status(403).json({ message: "Only group admin can add members" });
    }

    // check if already in group
    if (chat.participants.includes(userId)) {
      return res.status(400).json({ message: "User already in group" });
    }

    // check if user exists
    const userToAdd = await User.findById(userId);
    if (!userToAdd) {
      return res.status(404).json({ message: "User not found" });
    }

    chat.participants.push(userId);
    await chat.save();

    const updatedChat = await populateChat(GroupChat.findById(chat._id));
    res.status(200).json({ success: true, chat: updatedChat });
  } catch (error) {
    console.error("addMemberToGroup error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

// remove member from group
export const removeMemberFromGroup = async (req, res) => {
  try {
    const { chatId, userId } = req.body;
    const currentUserId = req.user.id;

    const chat = await GroupChat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    if (!chat.isGroupChat) {
      return res.status(400).json({ message: "Not a group chat" });
    }

    const isAdmin = chat.groupadmin.toString() === currentUserId;
    const isSelf = userId === currentUserId;

    // only admin or self can remove
    if (!isAdmin && !isSelf) {
      return res.status(403).json({ message: "Only admin can remove other members" });
    }

    // admin cant leave, transfer first
    if (isAdmin && userId === currentUserId) {
      return res.status(400).json({ message: "Admin cannot leave. Transfer admin first or delete group" });
    }

    chat.participants = chat.participants.filter(p => p.toString() !== userId);
    await chat.save();

    const updatedChat = await populateChat(GroupChat.findById(chat._id));
    res.status(200).json({ success: true, chat: updatedChat });
  } catch (error) {
    console.error("removeMemberFromGroup error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

// transfer group admin to another member
export const makeGroupAdmin = async (req, res) => {
  try {
    const { chatId, userId } = req.body;
    const currentUserId = req.user.id;

    const chat = await GroupChat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    if (!chat.isGroupChat) {
      return res.status(400).json({ message: "Not a group chat" });
    }

    // only current admin can transfer
    if (chat.groupadmin.toString() !== currentUserId) {
      return res.status(403).json({ message: "Only group admin can make new admins" });
    }

    // user must be in the group
    if (!chat.participants.includes(userId)) {
      return res.status(400).json({ message: "User not in group" });
    }

    chat.groupadmin = userId;
    await chat.save();

    const updatedChat = await populateChat(GroupChat.findById(chat._id));
    res.status(200).json({ success: true, chat: updatedChat });
  } catch (error) {
    console.error("makeGroupAdmin error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

// get all chats for current user
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

// get single chat by id
export const getSingleChat = async (req, res) => {
  try {
    const chat = await populateChat(GroupChat.findById(req.params.chatId));
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    // check if user is a member
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

// get existing chat or create new one with a user
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

    // find existing chat
    let chat = await populateChat(
      GroupChat.findOne({
        isGroupChat: false,
        participants: { $all: [currentUserId, userId], $size: 2 },
      })
    );

    // if not found, create new one
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
