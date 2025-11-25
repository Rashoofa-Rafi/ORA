const mongoose=require('mongoose')

const varientSchema=new mongoose.Schema({

    product_id:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'Product',
        required:true
    },
    stock:{
        type:Number,
        required:true,
        default:0
    },
    price:{
        type:Number,
        required:true
    },
    images:{
        type:[String],
        required:true
    },
    status:{
        type:String,
        enum: ['available', 'out of stock', 'discontinued'], 
        default: 'available' 
    },
    sku:{
        type:String,
        required:false,
        unique:true
    }

},
{timestamps:true})


module.exports=mongoose.model('Varient',varientSchema)