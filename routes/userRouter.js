const express=require("express")
const router=express.Router()
const userController=require('../controller/userController')
const viewProductController=require('../controller/viewProductController')
const {IsUserAuthenticated,IsUserLoggedOut} = require("../middleware/auth");
const homeController=require('../controller/homeController')

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



module.exports=router