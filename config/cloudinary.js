const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_KEY,
  api_secret: process.env.CLOUD_SECRET
});
console.log("Cloudinary ENV:", {
  name: process.env.CLOUD_NAME,
  key: process.env.CLOUD_KEY,
  secret: process.env.CLOUD_SECRET ? "Loaded" : "Missing"
});

module.exports = cloudinary;
