import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({

    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },

    receiver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },

    text: {
        type: String,
    },

    status: {

        type: String,

        enum: [
            "sent",
            "delivered",
            "read",
        ],

        default: "sent",
    },

    media: {
        type: String,
    },

}, {
    timestamps: true,
});

export const Message = mongoose.model(
    "Message",
    messageSchema
);