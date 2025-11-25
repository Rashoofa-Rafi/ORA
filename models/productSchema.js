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
    price:{
       type:Number,
       required:false
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
    productImages:{
      type:[String],
      required:false

    },
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
       required:false
    }
 },
 {timestamps:true}
)


module.exports=mongoose.model('Product',productSchema)