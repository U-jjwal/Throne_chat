import dotenv from "dotenv";

dotenv.config();

import http from "http";

import app from "./src/app.js";

import { Server } from "socket.io";

import connectDb from "./src/db/index.js";

import { initializeSocket } from "./src/utils/socket.js";

const PORT = process.env.PORT || 8000;



const server = http.createServer(app);



const io = new Server(server, {

    cors: {
        origin: process.env.CLIENT_URL,
        credentials: true,
    },
});

initializeSocket(io);



connectDb().then(() => {

    server.listen(PORT, () => {

        console.log(`Server running on port ${PORT}`);
    });
});