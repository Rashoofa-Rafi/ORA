const express=require("express")
const router=express.Router()
const userController=require('../controller/userController')



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


router.post('/signup',userController.signup)
router.post('/login',userController.login)


module.exports=router