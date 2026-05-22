import ImageKit from "imagekit";
import dotenv from "dotenv";
import crypto from "crypto";

dotenv.config();

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

export const uploadFile = async (fileBuffer, fileName) => {
  try {
    const uniqueName = `${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;
    const result = await imagekit.upload({
      file: fileBuffer.toString("base64"),
      fileName: fileName || uniqueName,
      folder: "/chat_app",
    });
    return {
      url: result.url,
      fileId: result.fileId,
      name: result.name,
    };
  } catch (error) {
    console.error("ImageKit upload error:", error);
    throw error;
  }
};

export default uploadFile;