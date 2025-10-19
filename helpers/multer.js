const multer = require('multer')
const path = require('path')


const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/uploads/category'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
})

const imageFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext !== '.png' && ext !== '.jpg' && ext !== '.jpeg') {
    return cb(new Error('Only images are allowed'), false);
  }
  cb(null, true);
}


const upload = multer({ storage:storage ,fileFilter:imageFilter })


module.exports={upload,imageFilter}