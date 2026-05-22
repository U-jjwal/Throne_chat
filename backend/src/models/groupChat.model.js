import mongoose from 'mongoose';

const groupChatSchema = new mongoose.Schema({
    isGroupChat: {

    },
    participants: [{

    }],
    groupName: String,
    groupAvatar: {
        public_id: String,
        url: String,
    },
    groupadmin: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    },
    latestMessage: [],
    }
, {timestamps: true});

export const GroupChat = mongoose.model("GroupChat", groupChatSchema);