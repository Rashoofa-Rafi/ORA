const mongoose = require('mongoose');


function arrayLimit(val) {
  return val.length >= 3
}

const variantSchema = new mongoose.Schema({
  product_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product', 
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  stock: {
    type: Number,
    required: true,
    min: 0
  },
  damagedStock: {
    type: Number,
    default: 0
  },
  color: {
    type: String,
    required: true,
    trim: true
  },
  images: {
    type: [String], 
    required: true,
    validate: [arrayLimit, 'At least 3 images are required']
  },
  sku: {
    type: String,
    required: true,
    unique: true
  },
}, { timestamps: true });



module.exports = mongoose.model('Variant', variantSchema);
