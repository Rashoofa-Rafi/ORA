const multer = require('multer')
const path = require('path')
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");


const storage = new CloudinaryStorage({
  cloudinary,
  params: (req, file) => {
    let folder = "others";

    
    if (file.fieldname.startsWith("variantImages_")) {
      folder = "variants";
    }
   else if (file.fieldname.startsWith("categoryImage")) {
      folder = "category";
    }
  else if (file.fieldname.startsWith("subcategoryImage")) {
      folder = "subcategory";
    }
    else if(file.fieldname.startsWith('profileImage')){
      folder='profile'
    }

    return {
      folder,
      allowed_formats: ["jpg", "jpeg", "png"],
      resource_type: "image",
    };
  },
});
const upload = multer({ storage });
module.exports = { upload };



