const mongoose=require('mongoose')


const productSchema=new mongoose.Schema({
    category_Id:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'Category',
        required:true,
    },
    subcategory_Id:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'Subcategory',
        required:true
    },
    productname:{
        type:String,
        required:true,
        trim:true
    },
    description:{
      type:String,
      required:false,
      trim:true
    },
    material:{
      type:String,
      required:false
    },
    dialType:{
      type:String,
      required:false
    },
    brand:{
        type:String,
        required:false
    },
    thumbnail: {
    type: String,
    required: false
  },
  variants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Variant"
  }],


  rating:{
      type:Number,
      required:false,
      default:0

    },
    totalStock:{
      type:Number,
      required:false,
      default:0
    },
    isListed:{
       type:Boolean,
       default:true
    }
 },
 {timestamps:true}
)


module.exports=mongoose.model('Product',productSchema)