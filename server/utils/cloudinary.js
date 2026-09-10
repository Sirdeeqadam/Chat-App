const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const hasCloudinaryConfig = () => Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

const uploadBuffer = (
  buffer,
  { folder, resourceType = "auto", publicId, overwrite = false } = {}
) => {
  if (!hasCloudinaryConfig()) {
    throw new Error("Cloudinary configuration is missing.");
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
        public_id: publicId,
        use_filename: false,
        unique_filename: true,
        overwrite,
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(result);
      }
    );

    uploadStream.end(buffer);
  });
};

module.exports = {
  cloudinary,
  hasCloudinaryConfig,
  uploadBuffer,
};
