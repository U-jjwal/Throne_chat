import mongoose from "mongoose";

const connectDb = async (req, res) => {
    try {

        await mongoose.connect(process.env.MONGODB_URL)
        res.status(200).json({message: "Connected to database"})
        console.log("Connected to database");
        
    } catch (error) {
        res.status(500).json({message: "Error connecting to database"})
        console.error("Error connecting to database:", error);
    }
}

export default connectDb;