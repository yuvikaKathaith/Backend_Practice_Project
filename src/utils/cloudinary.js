import {v2 as cloudinary} from "cloudinary"
import fs from "fs"

cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
    api_key: process.env.CLOUDINARY_API_KEY, 
    api_secret: process.env.CLOUDINARY_API_SECRET, 
});

const uploadOnCloudinary = (localFilePath) => {
    try {
        if(!localFilePath) return 
        //upload the file on cloudinary
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto"
        })
        //file uploaded on cloudinary
        console.log("File uploaded successfully", response.url)
        return response;
    } catch (error) {
        fs.unlink(localFilePath) //remove the locally saved temp file as the upload operation 
        return null;
    }
}
cloudinary.v2.uploader.upload_large("my_large_video.mp4", 
    { resource_type: "video" }, 
   function(error, result) {console.log(result, error); });