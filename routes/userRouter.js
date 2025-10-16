const express=require("express")
const router=express.Router()
const userController=require('../controller/userController')
const passport = require('passport')




router.get('/landinghome',(req,res)=>{
    res.render('user/landingHome')
})
router.get('/pageNotFound',(req,res)=>{
    res.render('user/page-404')
})
router.get('/signup',(req,res)=>{
    res.render('user/signup')
})
router.get('/otp',(req,res)=>{
    res.render('user/OTP')
})
router.get('/login',(req,res)=>{
    res.render('user/login')
})
router.get('/forgetPassword',(req,res)=>{
    res.render('user/forgetPassword')
})
router.get('/changePassword',(req,res)=>{
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
router.post('/changePassword',userController.changePassword)



module.exports=router