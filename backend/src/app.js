import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import connectDb from './db/index.js';



const app = express();

app.use(cookieParser())
app.use(cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
}))

app.use(express.json());
app.use(express.urlencoded({extended: true}));

app.get('/', (req, res) => {
    res.send("Working");
})



import authRouter from './routes/auth.routers.js';

app.use("/api/v1/auth", authRouter);








export default app;