const mongoose=require('mongoose')
const offerSchema=new mongoose.Schema({

    name: {
    type: String,
    required: true,
    trim: true
  },

  type: {
    type: String,
    enum: ["PRODUCT", "CATEGORY"],
    required: true
  },

  discountType: {
    type: String,
    enum: ["PERCENTAGE", "FLAT"],
    required: true
  },

  discountValue: {
    type: Number,
    required: true,
    min: 0
  },

  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    default: null
  },

  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    default: null
  },

  startDate: {
    type: Date,
    required: true
  },

  endDate: {
    type: Date,
    required: true
  },

  isActive: {
    type: Boolean,
    default: true
  }

},{timestamps:true})



module.exports=mongoose.model('Offer',offerSchema)