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
   else if (req.originalUrl.includes("/admin/category")) {
      folder = "category";
    }
  else if (req.originalUrl.includes("/admin/subcategory")) {
      folder = "subcategory";
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



// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     let folder = 'public/uploads/other'
//     if (req.originalUrl.startsWith("/admin/category")) folder = 'public/uploads/category'
//     else if (req.originalUrl.startsWith("/admin/subcategory")) folder = 'public/uploads/subcategory'
//     else if (file.fieldname.startsWith("variantImages_")) folder='public/uploads/variants'
      
//     cb(null, folder)
//   },
//   filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
// })

// const imageFilter = (req, file, cb) => {
//   const ext = path.extname(file.originalname).toLowerCase();
//   if (ext !== '.png' && ext !== '.jpg' && ext !== '.jpeg') {
//     return cb(new Error('Only images are allowed'), false);
//   }
//   cb(null, true);
// }


// const upload = multer({ storage:storage ,fileFilter:imageFilter })

// const multiUpload = upload.any()


// module.exports={upload,imageFilter,multiUpload}