import { ImageKit } from "@imagekit/nodejs/client.js";
import dotenv from 'dotenv';

dotenv.config()
const client = new ImageKit({
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY, 
});

async function uploadFile(file) {
    const result = await client.files.upload({
        file,
        fileName: "" + Date.now(),
        folder:"throne_Chat/files"
    })
    return result;
}

export default uploadFile;