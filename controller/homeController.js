const Product = require('../models/productSchema')
const Category=require('../models/categorySchema')
const Variants=require('../models/varientSchema');
const HTTP_STATUS = require('../middleware/statusCode');
const AppError=require('../config/AppError')
const User=require('../models/userSchema')
const Cart=require('../models/cartSchema')
const Wishlist=require('../models/wishlistSchema')

const loadHome=async(req,res,next)=>{
 try {
    
    
    const categories = await Category.find({
      name: { $in: ['Men', 'Women'] }
    }).select('name image');

    // --- Latest Trends (newly added products) ---
    const latestProductsData = await Product.find({ isListed: true })
      .sort({ createdAt: -1 })
      .limit(4)
      .populate('variants');

    const latestProducts = latestProductsData.map(p => {
      const firstVariant = p.variants?.[0];
      return {
        _id: p._id,
        name: p.productname,
        price: firstVariant?.price ,
        image: firstVariant?.images?.[0] 
      };
    });

    // --- Top Launches (based on most recently added variant) ---
    const topLaunchesData = await Product.find({ isListed: true })
      .populate({
        path: 'variants',
         options: { sort: { createdAt: -1 } } // latest variant first
      })
      .limit(4);

    const topLaunches = topLaunchesData.map(p => {
      const firstVariant = p.variants?.[0];
      return {
        _id: p._id,
        name: p.productname,
        price: firstVariant?.price ,
        image: firstVariant?.images?.[0] 
      }
    })
    const userId = req.session.user;

let cartCount = 0;
let wishlistCount = 0;

if (userId) {
   const cart = await Cart.findOne({ userId });
   if (cart) {
      cartCount = cart.totalItem;
   }

   const wishlist = await Wishlist.findOne({ userId });
   if (wishlist) {
      wishlistCount = wishlist.items.length;
   }
}

    return res.render('user/home', {
      
      categories,
      latestProducts,
      topLaunches,
      cartCount,
   wishlistCount,
      query: req.query
    });

  } catch (err) {
   next(new AppError(err.message ,HTTP_STATUS.INTERNAL_SERVER_ERROR))
  }
};
const logout = (req, res, next) => {
  req.logout(err => {
    if (err) return next(err);

    delete req.session.user;   
    
    res.setHeader('Cache-Control', 'no-store');
    return res.redirect("/user/login");
  });
};
const getdeleteAccount=async(req,res,next)=>{
  try {
    res.render('user/profile/account')
  } catch (err) {
    next(err)
  }
}
const deleteAccount=async(req,res,next)=>{
  try {
    const userId=req.session.user 
    if(!userId){
      throw new AppError('please login',HTTP_STATUS.UNAUTHORIZED)

    }
    const {confirmation}=req.body
    if(!confirmation ||confirmation!=='DELETE'){
      throw new AppError('confirmation text invalid',HTTP_STATUS.BAD_REQUEST)
    }
    const user=await User.findById(userId)
    if(!user){
      throw new AppError('User not found',HTTP_STATUS.BAD_REQUEST)
    }
    if(user.isDeleted){
      throw new AppError('Account already deleted',HTTP_STATUS.BAD_REQUEST)
    }
    user.isDeleted=true
    user.deletedAt=new Date()
    await user.save()

    delete req.session.user;
    

    return res.status(HTTP_STATUS.OK).json({
  success: true,
  message: "Account deleted successfully"
});
  } catch (err) {
    next(err)
  }
}

    


module.exports={loadHome,logout,getdeleteAccount,deleteAccount}