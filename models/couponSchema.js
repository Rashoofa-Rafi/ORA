const mongoose=require('mongoose')

const couponSchema= new mongoose.Schema({
    
    code:{
        type:String,
        required:true,
        unique: true,
        uppercase: true,
        trim: true
    },
    minOrderPrice:{
        type:Number,
        required:true
    },
    discountValue:{
        type:Number,
        required:true
    },
    
    endDate:{
        type:Date,
        required:true
    },
    discountType:{
        type:String,
        enum: ['PERCENTAGE', 'FLAT'],
        required:true
    },
    maxDiscountAmount:{
        type:Number
    },
    isActive:{
        type:Boolean,
        default:true
    },
    usageLimit:{
        type:Number,
        required:true
    },
    usedCount:{
        type:Number,
        default:0
    }
},{timestamps:true})

module.exports= mongoose.model('Coupon',couponSchema)