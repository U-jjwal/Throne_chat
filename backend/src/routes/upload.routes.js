import express from "express";
import { uploadMedia, uploadMultipleMedia } from "../controllers/upload.controller.js";
import { authenticateToken } from "../middleware/auth.middleware.js";
import { upload } from "../middleware/multer.middleware.js";

const router = express.Router();

router.use(authenticateToken);

// single file upload
router.post("/", upload.single("file"), uploadMedia);

// multiple files upload (max 10)
router.post("/multiple", upload.array("files", 10), uploadMultipleMedia);

export default router;
