import express from "express";
import { uploadMedia } from "../controllers/upload.controller.js";
import { authenticateToken } from "../middleware/auth.middleware.js";
import { upload } from "../middleware/multer.middleware.js";

const router = express.Router();

router.use(authenticateToken);
router.post("/", upload.single("file"), uploadMedia);

export default router;
