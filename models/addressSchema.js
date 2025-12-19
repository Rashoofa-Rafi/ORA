const mongoose=require('mongoose')
const addressSchema= mongoose.Schema({
    user_Id:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'User',
        required:true

    },
    addressType:{
        type:String,
        required:true
    },
    name:{
        type:String,
        required:true,
        trim:true
    },
    addressLine:{
        type:String,
        trim:true

    },
    city:{
        type:String,
        required:true,
        trim:true,
    },
    locality:{
        type:String,
        trim:true
    },
    
    state:{
        type:String,
        trim:true
    },
    pinCode:{
        type:String,
        required:true
    },
    phone:{
        type:String,
        required:true
    },
    altPhone:{
        type:String,
        required:false
    },
    isDefault:{
        type:Boolean,
        default:false
    }

},
{timestamps:true})
module.exports=mongoose.model('Address',addressSchema)