const cloudinary = require("cloudinary").v2;

const readEnv = (...names) => {
  for (const name of names) {
    const value = String(process.env[name] || "").trim();
    if (value) {
      return value;
    }
  }

  return "";
};

const cloudName = readEnv("CLOUDINARY_CLOUD_NAME", "CLOUD_NAME");
const apiKey = readEnv("CLOUDINARY_API_KEY", "CLOUD_API_KEY");
const apiSecret = readEnv("CLOUDINARY_API_SECRET", "CLOUD_API_SECRET");

cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret,
  secure: true,
});

const hasCloudinaryConfig = () => Boolean(
  cloudName &&
  apiKey &&
  apiSecret
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
