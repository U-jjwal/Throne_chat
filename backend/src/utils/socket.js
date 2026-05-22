import jwt from "jsonwebtoken";
import { redis } from "../db/redis.js";
import { Message }from "../models/message.model.js";

export const initializeSocket = (io) => {

    // SOCKET AUTH

    io.use((socket, next) => {

        try {

            const token =
                socket.handshake.auth.token;

            if (!token) {

                return next(
                    new Error("Unauthorized")
                );
            }

            const decoded = jwt.verify(
                token,
                process.env.JWT_SECRET
            );

            socket.user = decoded;

            next();

        } catch (error) {

            next(
                new Error("Invalid Token")
            );
        }
    });

    // CONNECTION

    io.on("connection", async (socket) => {

        const userId =
            socket.user.userId;

        console.log(
            "🟢 User Connected:",
            userId
        );

        // STORE SOCKET ID

        await redis.set(
            `socket:${userId}`,
            socket.id
        );

        // ADD ONLINE USER

        await redis.sadd(
            "online_users",
            userId
        );

        // GET ONLINE USERS

        const onlineUsers =
            await redis.smembers(
                "online_users"
            );

        // SEND TO ALL CLIENTS

        io.emit(
            "online_users",
            onlineUsers
        );

        // =========================
        // SEND MESSAGE
        // =========================

        socket.on(
            "send_message",
            async (data) => {

                try {

                    const {
                        receiverId,
                        text,
                    } = data;

                    const senderId =
                        socket.user.userId;

                    // SAVE MESSAGE

                    const message =
                        await Message.create({

                            sender:
                                senderId,

                            receiver:
                                receiverId,

                            text,

                            status: "sent",
                        });

                    // FIND RECEIVER SOCKET

                    const receiverSocketId =
                        await redis.get(
                            `socket:${receiverId}`
                        );

                    // RECEIVER ONLINE

                    if (
                        receiverSocketId
                    ) {

                        // UPDATE STATUS

                        message.status =
                            "delivered";

                        await message.save();

                        // SEND TO RECEIVER

                        io.to(
                            receiverSocketId
                        ).emit(
                            "receive_message",
                            message
                        );

                        // UPDATE SENDER

                        io.to(socket.id).emit(
                            "message_delivered",
                            {
                                messageId:
                                    message._id,
                            }
                        );
                    }

                    // SEND MESSAGE BACK TO SENDER

                    io.to(socket.id).emit(
                        "message_sent",
                        message
                    );

                } catch (error) {

                    console.log(error);
                }
            }
        );

        // =========================
        // READ RECEIPT
        // =========================

        socket.on(
            "mark_read",
            async ({ messageId }) => {

                try {

                    const message =
                        await Message.findById(
                            messageId
                        );

                    if (!message) return;

                    message.status =
                        "read";

                    await message.save();

                    // FIND SENDER SOCKET

                    const senderSocket =
                        await redis.get(
                            `socket:${message.sender}`
                        );

                    // EMIT BLUE TICK

                    if (senderSocket) {

                        io.to(
                            senderSocket
                        ).emit(
                            "message_read",
                            {
                                messageId,
                            }
                        );
                    }

                } catch (error) {

                    console.log(error);
                }
            }
        );

        // =========================
        // DISCONNECT
        // =========================

        socket.on(
            "disconnect",
            async () => {

                console.log(
                    "🔴 User Disconnected:",
                    userId
                );

                // REMOVE SOCKET

                await redis.del(
                    `socket:${userId}`
                );

                // REMOVE ONLINE USER

                await redis.srem(
                    "online_users",
                    userId
                );

                // SAVE LAST SEEN

                await redis.set(
                    `lastSeen:${userId}`,
                    Date.now()
                );

                // UPDATED USERS

                const updatedUsers =
                    await redis.smembers(
                        "online_users"
                    );

                // EMIT UPDATED USERS

                io.emit(
                    "online_users",
                    updatedUsers
                );
            }
        );
    });
};