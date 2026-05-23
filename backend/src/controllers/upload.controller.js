import uploadFile from "../services/storage.service.js";
import { getMessageTypeFromMime } from "../middleware/multer.middleware.js";

// upload single file
export const uploadMedia = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // upload to imagekit
    const result = await uploadFile(req.file.buffer, req.file.originalname);
    const messageType = getMessageTypeFromMime(req.file.mimetype);

    res.status(200).json({
      success: true,
      url: result.url,
      fileId: result.fileId,
      fileName: result.name,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      messageType,
    });
  } catch (error) {
    console.error("uploadMedia error:", error.message);
    res.status(500).json({ message: "Upload failed: " + error.message });
  }
};

// upload multiple files at once
export const uploadMultipleMedia = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No files uploaded" });
    }

    // upload all files in parallel
    const uploadPromises = req.files.map(async (file) => {
      const result = await uploadFile(file.buffer, file.originalname);
      return {
        url: result.url,
        fileId: result.fileId,
        fileName: result.name,
        fileSize: file.size,
        mimeType: file.mimetype,
        messageType: getMessageTypeFromMime(file.mimetype),
      };
    });

    const uploadedFiles = await Promise.all(uploadPromises);

    res.status(200).json({
      success: true,
      files: uploadedFiles,
    });
  } catch (error) {
    console.error("uploadMultipleMedia error:", error.message);
    res.status(500).json({ message: "Upload failed: " + error.message });
  }
};
