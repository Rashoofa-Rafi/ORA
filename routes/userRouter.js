const express=require("express")
const router=express.Router()
const userController=require('../controller/userController')
const viewProductController=require('../controller/viewProductController')
const {IsUserAuthenticated,IsUserLoggedOut} = require("../middleware/auth");
const homeController=require('../controller/homeController')
const profileController=require('../controller/profileController')
const addressController=require('../controller/addressController')
const cartController=require('../controller/cartController')
const wishlistController=require('../controller/wishlistController')
const checkoutController=require('../controller/checkoutController')
const orderController=require('../controller/orderController')
const couponController=require('../controller/couponController')
const walletController=require('../controller/walletController')



const {upload}=require('../helpers/multer')
const nocache=require('../middleware/cache')
const passport = require('passport')


//----User Authentication---

router.get('/home',homeController.loadHome)
router.get('/pagenotfound',userController.loadpage404)
router.get('/signup',IsUserLoggedOut,nocache,userController.loadSignup)
router.get('/verify-otp',userController.loadOTP)
router.get('/login',IsUserLoggedOut,nocache,userController.loadLogin)
router.get('/forget-password',userController.loadforgetPassword)
router.get('/change-password',userController.loadchangePassword)
router.get('/logout',  homeController.logout)

router.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
)

router.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login', session: true }),
  (req, res) => {
req.session.user = req.user
    res.redirect('/user/home'); 
  }
)


router.post('/signup',userController.signup)
router.post('/login',userController.login)
router.post('/verify-otp',userController.verifyOTP)
router.post('/resend-otp',userController.resendOtp)
router.post('/forget-password',userController.forgetPassword)
router.post('/change-password',userController.changePassword)

//---All Products

router.get('/allproduct',viewProductController.listProducts)
router.get('/product-details/:id',IsUserAuthenticated,nocache,viewProductController.getProductDetails)

//---User Profile

router.get('/profile/profile',IsUserAuthenticated,nocache,profileController.getUserProfile)
router.post("/profile/profile/upload-image",upload.single("profileImage"),profileController.uploadProfileImage)
router.get('/profile/edit-profile',IsUserAuthenticated,nocache,profileController.getEditProfile)
router.get('/profile/changepassword',IsUserAuthenticated,nocache,profileController.getchangePassword)
router.get('/profile/forget-password',IsUserAuthenticated,nocache,profileController.getforgetPassword)
router.get('/profile/otp-verify',IsUserAuthenticated,nocache,profileController.getverifyOTP)
router.get('/profile/new-password',IsUserAuthenticated,nocache,profileController.getNewPassword)

router.post('/profile/edit-profile',IsUserAuthenticated,nocache,upload.single('profileImage'),profileController.editProfile)
router.post('/profile/changepassword',IsUserAuthenticated,nocache,profileController.changePassword)
router.post('/profile/forget-password',IsUserAuthenticated,nocache,profileController.forgetPassword)
router.post('/profile/resendOtp',IsUserAuthenticated,nocache,profileController.resendOtp)
router.post('/profile/otp-verify',IsUserAuthenticated,nocache,profileController.verifyOTP)
router.post('/profile/new-password',IsUserAuthenticated,nocache,profileController.NewPassword)
router.post('/profile/email-change',IsUserAuthenticated,nocache,profileController.emailChange)


//Address Management

router.get('/profile/address',IsUserAuthenticated,nocache,addressController.getUserAddress)
router.get('/profile/address/:id',IsUserAuthenticated,nocache,addressController.getSingleAddress)

router.post('/profile/address',IsUserAuthenticated,nocache,addressController.addUserAddress)
router.put('/profile/address/:id',IsUserAuthenticated,nocache,addressController.editUserAddress)
router.delete('/profile/address/:id',IsUserAuthenticated,nocache,addressController.deleteUserAddress)
router.post('/profile/address/:id/default',IsUserAuthenticated,nocache, addressController.setDefaultAddress)

//referral

router.get('/profile/referral',IsUserAuthenticated,nocache,couponController.getReferral)

//coupon 
router.get('/profile/coupons',IsUserAuthenticated,nocache,couponController.getUserCoupon)

//wallet
router.get('/profile/wallet',walletController.getWallet)

//cart management

router.get('/cart',IsUserAuthenticated,nocache,cartController.getCart)
router.post('/cart/add',IsUserAuthenticated,nocache,cartController.addToCart)
router.post('/cart/update-quantity',IsUserAuthenticated,nocache,cartController.updateCartQuantity)
router.delete('/cart/remove',IsUserAuthenticated,nocache,cartController.removeFromCart)
router.get('/cart/proceedToCheckout',IsUserAuthenticated,nocache,cartController.proceedToCheckout)

//wishlist management

router.get('/wishlist',IsUserAuthenticated,nocache,wishlistController.getWishlist)
router.post('/wishlist/add',IsUserAuthenticated,nocache,wishlistController.addToWishlist)
router.delete('/wishlist/remove',IsUserAuthenticated,nocache,wishlistController.removeFromWishlist)



//checkout

router.get('/checkout',IsUserAuthenticated,nocache,checkoutController.getCheckout)
router.post('/checkout',IsUserAuthenticated,nocache,checkoutController.checkoutContinue)
router.get('/payment',IsUserAuthenticated,nocache,checkoutController.getPaymentPage)
router.post('/payment/place-order',IsUserAuthenticated,nocache,checkoutController.placeOrder)
router.get('/checkout/coupons',IsUserAuthenticated,nocache,couponController.getAvailableCoupons);

router.post('/payment/verify',IsUserAuthenticated,nocache,checkoutController.verifyRazorpayPayment)
router.get('/order-success/:orderId',IsUserAuthenticated,nocache,checkoutController.getOrderSuccess)
router.post('/profile/orders/:orderId/payment-failed', IsUserAuthenticated, nocache, checkoutController.paymentFailed);

router.post('/profile/orders/:orderId/retry-payment',IsUserAuthenticated,nocache, checkoutController.createRetryRazorpayOrder)
router.post('/coupons/apply',IsUserAuthenticated,nocache,checkoutController.applyCoupon)
router.delete('/coupons/remove',IsUserAuthenticated,nocache,checkoutController.removeCoupon)

//Order management in user side

router.get('/profile/orders',IsUserAuthenticated,nocache,orderController.getOrders)
router.get('/profile/orders/:orderId',IsUserAuthenticated,nocache,orderController.getOrderDetails)
router.post('/profile/orders/:orderId/items/:itemId/cancel',IsUserAuthenticated,nocache,orderController.cancelOrderItem)
router.post('/profile/orders/:orderId/items/:itemId/return',IsUserAuthenticated,nocache,orderController.returnOrderItem)
router.get('/profile/orders/:orderId/items/:itemId/invoice',IsUserAuthenticated,nocache,orderController.downloadInvoice)
  
  
router.get('/profile/delete-account',IsUserAuthenticated,nocache,homeController.getdeleteAccount)
router.post('/profile/delete-account',IsUserAuthenticated,nocache,homeController.deleteAccount)




module.exports=router