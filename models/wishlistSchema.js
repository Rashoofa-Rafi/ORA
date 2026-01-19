const mongoose=require('mongoose')
const wishlistItemSchema=new mongoose.Schema({
        productId: {
             type: mongoose.Schema.Types.ObjectId,
             ref: 'Product',
             required: true
         },
         variantId: {
                  type: mongoose.Schema.Types.ObjectId,
                  ref: 'Variant',
                  required: true
              }
})
const wishlistSchema=new mongoose.Schema({
    userId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'User'
    },
    items:[wishlistItemSchema]


},{timestamps:true})


module.exports=mongoose.model('Wishlist',wishlistSchema)