import Message from "../models/message.model.js";

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

                    sender: senderId,

                    receiver: receiverId,

                    text,

                    status: "sent",
                });

            // FIND RECEIVER SOCKET

            const receiverSocketId =
                await redis.get(
                    `socket:${receiverId}`
                );

            // RECEIVER ONLINE

            if (receiverSocketId) {

                // UPDATE STATUS

                message.status =
                    "delivered";

                await message.save();

                // SEND MESSAGE

                io.to(receiverSocketId).emit(
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

            // SEND BACK TO SENDER

            io.to(socket.id).emit(
                "message_sent",
                message
            );

        } catch (error) {

            console.log(error);
        }
    }
);