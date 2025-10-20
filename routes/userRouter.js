const express=require("express")
const router=express.Router()
const userController=require('../controller/userController')
const {isUserAuthenticated,isLoggedout}= require('../middleware/userAuth')
const nocache=require('../middleware/cache')
const passport = require('passport')




router.get('/landinghome',nocache,isUserAuthenticated,(req,res)=>{
    res.render('user/landingHome')
})
router.get('/pageNotFound',(req,res)=>{
    res.render('user/page-404')
})
router.get('/signup',isLoggedout,(req,res)=>{
    res.render('user/signup')
})
router.get('/otp',isLoggedout,(req,res)=>{
    res.render('user/OTP')
})
router.get('/login',isLoggedout,(req,res)=>{
    res.render('user/login')
})
router.get('/forgetPassword',isLoggedout,(req,res)=>{
    res.render('user/forgetPassword')
})
router.get('/changePassword',nocache,isUserAuthenticated,(req,res)=>{
    res.render('user/changePassword')
})
router.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
)

router.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login', session: true }),
  (req, res) => {

    res.redirect('/user/landingHome'); 
  }
)


router.post('/signup',userController.signup)
router.post('/login',userController.login)
router.post('/verifyOTP',userController.verifyOTP)
router.post('/resendOtp',userController.resendOtp)
router.post('/forgetPassword',userController.forgetPassword)
router.post('/changePassword',isUserAuthenticated,userController.changePassword)

router.get('/logout',nocache, isUserAuthenticated, userController.logout);



module.exports=router