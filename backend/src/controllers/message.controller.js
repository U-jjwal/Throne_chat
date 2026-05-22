import { Message } from "../models/message.model.js";
import { GroupChat } from "../models/groupChat.model.js";

const assertChatMember = async (chatId, userId) => {
  const chat = await GroupChat.findById(chatId);
  if (!chat) return { error: "Chat not found", status: 404 };
  const isMember = chat.participants.map(String).includes(userId);
  if (!isMember) return { error: "Not a member of this chat", status: 403 };
  return { chat };
};

export const getMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const { error, status } = await assertChatMember(chatId, req.user.id);
    if (error) return res.status(status).json({ message: error });

    const messages = await Message.find({ chatId })
      .populate("senderId", "fullName avatar")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Message.countDocuments({ chatId });

    res.status(200).json({
      success: true,
      page,
      totalPages: Math.ceil(total / limit),
      total,
      messages: messages.reverse(),
    });
  } catch (error) {
    console.error("getMessages error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

// Send message via REST (fallback)
export const sendMessage = async (req, res) => {
  try {
    const { chatId, text, media, messageType = "text" } = req.body;
    
    if (!chatId) {
      return res.status(400).json({ message: "chatId is required" });
    }

    const { error, status, chat } = await assertChatMember(chatId, req.user.id);
    if (error) return res.status(status).json({ message: error });

    const message = await Message.create({
      chatId,
      senderId: req.user.id,
      text: text || "",
      media: media || "",
      messageType,
      deliveredTo: [req.user.id],
      readBy: [req.user.id],
      status: "sent",
    });

    await message.populate("senderId", "fullName avatar");
    
    // Update chat's latest message
    await GroupChat.findByIdAndUpdate(chatId, { latestMessage: message._id });

    res.status(201).json({ success: true, message });
  } catch (error) {
    console.error("sendMessage error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};