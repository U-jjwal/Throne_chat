import mongoose from "mongoose";

// group chat schema (also used for private chats)
const groupChatSchema = new mongoose.Schema(
  {
    isGroupChat: {
      type: Boolean,
      default: false,
    },
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    groupName: {
      type: String,
      trim: true,
    },
    groupAvatar: {
      public_id: String,
      url: String,
    },
    groupadmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    latestMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },
  },
  { timestamps: true }
);

export const GroupChat = mongoose.model("GroupChat", groupChatSchema);