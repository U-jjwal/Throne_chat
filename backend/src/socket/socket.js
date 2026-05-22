import jwt from "jsonwebtoken";
import { redis } from "../db/redis.js";
import { Message } from "../models/message.model.js";
import { GroupChat } from "../models/groupChat.model.js";
import { User } from "../models/user.model.js";

export const initializeSocket = (io) => {
  // Socket authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error("Unauthorized"));
      }
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      next();
    } catch (error) {
      next(new Error("Invalid Token"));
    }
  });

  io.on("connection", async (socket) => {
    const userId = socket.user.userId;
    console.log("🟢 User Connected:", userId);

    // Store socket ID
    await redis.set(`socket:${userId}`, socket.id);

    // Add to online users
    await redis.sadd("online_users", userId);
    await User.findByIdAndUpdate(userId, { isOnline: true, lastSeen: new Date() });

    // Get all online users and broadcast
    const onlineUsers = await redis.smembers("online_users");
    io.emit("online_users", onlineUsers);

    // Join user's personal room for direct messages
    socket.join(`user:${userId}`);

    // ==================== TYPING INDICATOR ====================
    socket.on("typing", async ({ chatId, receiverId, isTyping }) => {
      if (receiverId) {
        const receiverSocketId = await redis.get(`socket:${receiverId}`);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("user_typing", {
            userId,
            chatId,
            isTyping,
          });
        }
      } else if (chatId) {
        // For group chats, emit to all participants except sender
        const chat = await GroupChat.findById(chatId);
        if (chat) {
          for (const participant of chat.participants) {
            if (participant.toString() !== userId) {
              const participantSocketId = await redis.get(`socket:${participant}`);
              if (participantSocketId) {
                io.to(participantSocketId).emit("user_typing", {
                  userId,
                  chatId,
                  isTyping,
                });
              }
            }
          }
        }
      }
    });

    // ==================== SEND MESSAGE ====================
    socket.on("send_message", async (data) => {
      try {
        const { chatId, text, media, messageType = "text" } = data;
        const senderId = socket.user.userId;

        // Get chat details
        const chat = await GroupChat.findById(chatId);
        if (!chat) {
          socket.emit("error", { message: "Chat not found" });
          return;
        }

        // Check if sender is a participant
        if (!chat.participants.map(String).includes(senderId)) {
          socket.emit("error", { message: "Not a participant" });
          return;
        }

        // Create message
        const message = await Message.create({
          chatId,
          senderId,
          text: text || "",
          media: media || "",
          messageType,
          deliveredTo: [senderId],
          readBy: [senderId],
          status: "sent",
        });

        // Populate sender info
        await message.populate("senderId", "fullName avatar");

        // Update latest message in chat
        await GroupChat.findByIdAndUpdate(chatId, { latestMessage: message._id });

        // Send to all participants
        const deliveryPromises = [];
        for (const participantId of chat.participants) {
          const participantSocketId = await redis.get(`socket:${participantId}`);
          if (participantSocketId) {
            // Mark as delivered for online participants
            if (participantId.toString() !== senderId) {
              if (!message.deliveredTo.map(String).includes(participantId)) {
                message.deliveredTo.push(participantId);
              }
            }
            io.to(participantSocketId).emit("receive_message", message);
          }
        }

        // Update delivered status
        await message.save();

        // Send confirmation to sender
        socket.emit("message_sent", message);

        // Emit delivered update to sender
        socket.emit("message_delivered", { messageId: message._id });
      } catch (error) {
        console.error("Send message error:", error);
        socket.emit("error", { message: "Failed to send message" });
      }
    });

    // ==================== READ RECEIPT ====================
    socket.on("mark_read", async ({ messageId, chatId }) => {
      try {
        const userId = socket.user.userId;

        const message = await Message.findById(messageId);
        if (!message) return;

        // Mark as read
        if (!message.readBy.map(String).includes(userId)) {
          message.readBy.push(userId);
          message.status = "read";
          await message.save();
        }

        // Mark as delivered if not already
        if (!message.deliveredTo.map(String).includes(userId)) {
          message.deliveredTo.push(userId);
          await message.save();
        }

        // Notify sender that message was read
        const senderSocketId = await redis.get(`socket:${message.senderId}`);
        if (senderSocketId) {
          io.to(senderSocketId).emit("message_read", {
            messageId,
            chatId,
            readBy: userId,
          });
        }
      } catch (error) {
        console.error("Mark read error:", error);
      }
    });

    // ==================== MARK ALL MESSAGES AS READ IN CHAT ====================
    socket.on("mark_chat_read", async ({ chatId }) => {
      try {
        const userId = socket.user.userId;

        const messages = await Message.find({
          chatId,
          readBy: { $ne: userId },
        });

        for (const message of messages) {
          message.readBy.push(userId);
          if (!message.deliveredTo.map(String).includes(userId)) {
            message.deliveredTo.push(userId);
          }
          message.status = "read";
          await message.save();

          // Notify sender
          const senderSocketId = await redis.get(`socket:${message.senderId}`);
          if (senderSocketId) {
            io.to(senderSocketId).emit("message_read", {
              messageId: message._id,
              chatId,
              readBy: userId,
            });
          }
        }
      } catch (error) {
        console.error("Mark chat read error:", error);
      }
    });

    // ==================== DISCONNECT ====================
    socket.on("disconnect", async () => {
      console.log("🔴 User Disconnected:", userId);

      // Remove socket
      await redis.del(`socket:${userId}`);
      await redis.srem("online_users", userId);

      // Update last seen
      await User.findByIdAndUpdate(userId, {
        isOnline: false,
        lastSeen: new Date(),
      });
      await redis.set(`lastSeen:${userId}`, Date.now());

      // Broadcast updated online users
      const updatedUsers = await redis.smembers("online_users");
      io.emit("online_users", updatedUsers);
    });
  });
};
