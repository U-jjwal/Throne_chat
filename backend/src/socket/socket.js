import jwt from "jsonwebtoken";
import { redis } from "../db/redis.js";
import { Message } from "../models/message.model.js";
import { GroupChat } from "../models/groupChat.model.js";
import { User } from "../models/user.model.js";

export const initializeSocket = (io) => {
  // authenticate socket connection
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
    console.log("User Connected:", userId);

    // save socket id in redis
    await redis.set(`socket:${userId}`, socket.id);

    // mark user online
    await redis.sadd("online_users", userId);
    await User.findByIdAndUpdate(userId, {
      isOnline: true,
      lastSeen: new Date(),
    });

    // broadcast online users to everyone
    const onlineUsers = await redis.smembers("online_users");
    io.emit("online_users", onlineUsers);

    // get all chats this user is part of
    const userChats = await GroupChat.find({ participants: userId });
    const chatIds = userChats.map((chat) => chat._id);

    // find messages that were not delivered while user was offline
    const undeliveredMessages = await Message.find({
      chatId: { $in: chatIds },
      deliveredTo: { $ne: userId },
      senderId: { $ne: userId },
    });

    // mark them as delivered and send to user
    for (const message of undeliveredMessages) {
      if (!message.deliveredTo.map(String).includes(userId)) {
        message.deliveredTo.push(userId);

        if (message.status === "sent") {
          message.status = "delivered";
          await message.save();

          // notify sender about delivery
          const senderSocketId = await redis.get(`socket:${message.senderId}`);
          if (senderSocketId) {
            io.to(senderSocketId).emit("message_delivered", {
              messageId: message._id,
              chatId: message.chatId,
            });
          }
        }

        // send message to this user
        await message.populate("senderId", "fullName avatar");
        socket.emit("receive_message", message);
      }
    }

    // find delivered but unread messages and send them
    const unreadMessages = await Message.find({
      chatId: { $in: chatIds },
      readBy: { $ne: userId },
      senderId: { $ne: userId },
      status: "delivered",
    });

    for (const message of unreadMessages) {
      await message.populate("senderId", "fullName avatar");
      socket.emit("receive_message", message);
    }

    // send message
    socket.on("send_message", async (data) => {
      try {
        const { chatId, text, media, messageType = "text", tempId } = data;
        const senderId = socket.user.userId;

        // check if chat exists
        const chat = await GroupChat.findById(chatId);
        if (!chat) {
          socket.emit("error", { message: "Chat not found" });
          return;
        }

        // check if user is a participant
        if (!chat.participants.map(String).includes(senderId)) {
          socket.emit("error", { message: "Not a participant" });
          return;
        }

        // create message in db
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

        await message.populate("senderId", "fullName avatar");

        // update latest message in chat
        await GroupChat.findByIdAndUpdate(chatId, { latestMessage: message._id });

        // send back to sender with optimistic tempId attached
        socket.emit("message_sent", {
          ...message.toObject(),
          tempId,
        });

        // send to all other participants who are online in parallel
        let deliveredCount = 0;
        await Promise.all(chat.participants.map(async (participantId) => {
          if (participantId.toString() !== senderId) {
            const participantSocketId = await redis.get(`socket:${participantId}`);
            if (participantSocketId) {
              if (!message.deliveredTo.map(String).includes(participantId)) {
                message.deliveredTo.push(participantId);
                deliveredCount++;
              }
              io.to(participantSocketId).emit("receive_message", message);
            }
          }
        }));

        // if delivered to at least one, update status
        if (deliveredCount > 0) {
          message.status = "delivered";
        }

        // Just one single database save instead of double sequential saves
        await message.save();

        if (deliveredCount > 0) {
          socket.emit("message_delivered", {
            messageId: message._id,
            chatId: message.chatId,
          });
        }
      } catch (error) {
        console.error("Send message error:", error);
        socket.emit("error", { message: "Failed to send message" });
      }
    });

    // mark single message as read
    socket.on("mark_read", async ({ messageId, chatId }) => {
      try {
        const userId = socket.user.userId;

        const message = await Message.findById(messageId);
        if (!message) return;

        if (!message.readBy.map(String).includes(userId)) {
          message.readBy.push(userId);
          message.status = "read";

          // also mark as delivered if not already
          if (!message.deliveredTo.map(String).includes(userId)) {
            message.deliveredTo.push(userId);
          }

          // Non-blocking database write in the background
          message.save().catch((err) => console.error("Error saving read status:", err));

          // notify sender about read receipt concurrently
          const senderSocketId = await redis.get(`socket:${message.senderId}`);
          if (senderSocketId) {
            io.to(senderSocketId).emit("message_read", {
              messageId,
              chatId,
              readBy: userId,
              readAt: new Date(),
            });
          }
        }
      } catch (error) {
        console.error("Mark read error:", error);
      }
    });

    // mark all messages in a chat as read in one concurrent parallel execution
    socket.on("mark_chat_read", async ({ chatId }) => {
      try {
        const userId = socket.user.userId;

        // find all unread messages in this chat
        const unreadMessages = await Message.find({
          chatId: chatId,
          readBy: { $ne: userId },
          senderId: { $ne: userId },
        });

        if (unreadMessages.length === 0) return;

        // Process all updates in parallel
        await Promise.all(unreadMessages.map(async (message) => {
          if (!message.readBy.map(String).includes(userId)) {
            message.readBy.push(userId);

            // also mark delivered
            if (!message.deliveredTo.map(String).includes(userId)) {
              message.deliveredTo.push(userId);
            }

            message.status = "read";
            
            // Fire save and notification concurrently
            const savePromise = message.save().catch((err) => console.error("Error batch saving read status:", err));
            
            const notifyPromise = (async () => {
              const senderSocketId = await redis.get(`socket:${message.senderId}`);
              if (senderSocketId) {
                io.to(senderSocketId).emit("message_read", {
                  messageId: message._id,
                  chatId: chatId,
                  readBy: userId,
                  readAt: new Date(),
                });
              }
            })();

            await Promise.all([savePromise, notifyPromise]);
          }
        }));

        // handle messages that are sent but not delivered yet
        const deliveredMessages = await Message.find({
          chatId: chatId,
          deliveredTo: { $ne: userId },
          senderId: { $ne: userId },
          status: { $in: ["sent", "delivered"] },
        });

        for (const message of deliveredMessages) {
          if (!message.deliveredTo.map(String).includes(userId)) {
            message.deliveredTo.push(userId);

            if (message.status !== "read") {
              message.status = "delivered";
            }
            await message.save();

            // notify sender about delivery
            const senderSocketId = await redis.get(`socket:${message.senderId}`);
            if (senderSocketId) {
              io.to(senderSocketId).emit("message_delivered", {
                messageId: message._id,
                chatId: chatId,
              });
            }
          }
        }
      } catch (error) {
        console.error("Mark chat read error:", error);
      }
    });

    // typing indicator
    socket.on("typing", async ({ chatId, receiverId, isTyping }) => {
      // if direct chat, send to specific user
      if (receiverId) {
        const receiverSocketId = await redis.get(`socket:${receiverId}`);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("user_typing", {
            userId,
            chatId,
            isTyping,
          });
        }
      // if group chat, send to all participants
      } else if (chatId) {
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

    // user disconnected
    socket.on("disconnect", async () => {
      console.log("User Disconnected:", userId);

      // cleanup redis
      await redis.del(`socket:${userId}`);
      await redis.srem("online_users", userId);

      // update last seen in db
      const lastSeen = new Date();
      await User.findByIdAndUpdate(userId, {
        isOnline: false,
        lastSeen: lastSeen,
      });
      await redis.set(`lastSeen:${userId}`, lastSeen.getTime());

      // broadcast updated online users
      const updatedUsers = await redis.smembers("online_users");
      io.emit("online_users", updatedUsers);
    });
  });
};

async function getChatIds(userId) {
  const chats = await GroupChat.find({ participants: userId });
  return chats.map((chat) => chat._id.toString());
}