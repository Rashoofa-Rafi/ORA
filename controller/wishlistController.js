const Cart = require('../models/cartSchema')
const Variant = require('../models/varientSchema')
const Product=require('../models/productSchema')
const User = require('../models/userSchema')
const AppError = require('../config/AppError')
const HTTP_STATUS = require('../middleware/statusCode')
const notFound = require('../middleware/notFound')

const getWishlist= async (req,res,next)=>{
try {
    
} catch (err) {
    next(err)
}
}
module.exports={
    getWishlist
}