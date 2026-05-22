import uploadFile from "../services/storage.service.js";

export const uploadMedia = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const result = await uploadFile(req.file.buffer, req.file.originalname);

    // Determine message type based on file mimetype
    let messageType = "file";
    if (req.file.mimetype.startsWith("image/")) messageType = "image";
    else if (req.file.mimetype.startsWith("video/")) messageType = "video";

    res.status(200).json({
      success: true,
      url: result.url,
      fileId: result.fileId,
      fileName: result.name,
      messageType,
    });
  } catch (error) {
    console.error("uploadMedia error:", error.message);
    res.status(500).json({ message: "Upload failed: " + error.message });
  }
};
