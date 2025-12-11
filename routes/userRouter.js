const express=require("express")
const router=express.Router()
const userController=require('../controller/userController')
const viewProductController=require('../controller/viewProductController')

const homeController=require('../controller/homeController')
const {isUserAuthenticated,isLoggedout}= require('../middleware/userAuth')
const nocache=require('../middleware/cache')
const passport = require('passport')


//----User Authentication---

router.get('/home',homeController.loadHome)
router.get('/pagenotfound',userController.loadpage404)
router.get('/signup',userController.loadSignup)
router.get('/verify-otp',userController.loadOTP)
router.get('/login',userController.loadLogin)
router.get('/forget-password',userController.loadforgetPassword)
router.get('/change-password',userController.loadchangePassword)
router.get('/logout',nocache, isUserAuthenticated, userController.logout)

router.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
)

router.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login', session: true }),
  (req, res) => {

    res.redirect('/user/Home'); 
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
router.get('/product-details/:id',viewProductController.getProductDetails)



module.exports=router