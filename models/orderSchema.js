const mongoose=require('mongoose')


const orderItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true
  },
  variantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Variant",
    required: true
  },
  productName: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  price: {
    type: Number,
    required: true
  },
  image:{
    type:String,
    required:true
  },
//   offerPercentage: {
//     type: Number,
//     default: 0
//   },
  itemStatus: {
    type: String,
    enum: [
      "pending",
      "confirmed",
      "shipped",
      "delivered",
      "cancelled",
      "return_requested",
      "returning",
      "returned",
      
    ],
    default: "pending"
  },
  cancellationReason:{
    type:String
  } ,
  returnReason: {
    type:String
  },
  adminRemark:{
    type:String
} ,
  expectedDelivery: {
    type:Date}
});

const addressSchema = new mongoose.Schema({
  addressType: String,
  name: String,
  addressLine:String,
  city: String,
  locality: String,
  landmark: String,
  state: String,
  pincode: String,
  phone: String,
  altPhone: String
},{_id:false});
const orderSchema = new mongoose.Schema({
  orderId: {
    type: String,
    required: true,
    unique: true
  },

  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  paymentMethod: {
    type: String,
    enum: ["COD", "RAZORPAY", "UPI", "CARD", "WALLET"],
    required: true
  },

  totalItems: {
    type: Number,
    required: true
  },

  totalPrice: {
    type: Number,
    required: true
  },

  deliveryCharge: {
    type: Number,
    default: 0
  },

  platformFee: {
    type: Number,
    default: 0
  },

//   couponCode: {
//     type: String
//   },

//   couponDiscount: {
//     type: Number,
//     default: 0
//   },

  discount: {
    type: Number,
    default: 0
  },

  orderStatus: {
    type: String,
    enum: [
      "pending",
      "confirmed",
      "shipped",
      "delivered",
      "cancelled",
      "return_requested",
      "returning",
      "returned",
      "processing",
      "partially_cancelled",
      "partially_returned",
      "partially_delivered"
    ],
    default: "pending"
  },

  orderItems: {
    type: [orderItemSchema],
    required: true
  },

  address: {
    type: addressSchema,
    required: true
  }

}, { timestamps: true })
module.exports=mongoose.model('Order',orderSchema)