const mongoose=require('mongoose')

const cartItemSchema = new mongoose.Schema({
     productId: {
         type: mongoose.Schema.Types.ObjectId,
         ref: 'Product',
         required: true
     },
     categoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: true
     },
     subcategoryId:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subcategory',
        required: true
     },
    variantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Variant'
    },
    quantity: {
        type: Number,
        required: true,
        min: 1
    }
});

const cartSchema=new mongoose.Schema({

    userId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'User'
    },
    totalItem:{
        type:Number,
        default:0
    },
    totalPrice:{
        type:Number,
        default:0
    },
    items:[cartItemSchema]

},{timestamps:true})

module.exports=mongoose.model('Cart',cartSchema)