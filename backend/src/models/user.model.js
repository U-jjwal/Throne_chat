import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    fullName: {
        type: String,   
        required: true,
    },
    email: {
        type: String,   
        required: true,
    },
    password: {
        type: String,   
        required: true,
    },
    isVerified: {
        type: Boolean,
        default: false,
    },
    avatar: {
        public_id: String,
        url: String,
    },
    lastSeen: Date,
},
{timestamps: true}
);

export const User = mongoose.model("User", userSchema);

