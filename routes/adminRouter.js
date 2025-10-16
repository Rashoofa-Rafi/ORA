const express=require('express')
const router=express.Router()
const adminController=require("../controller/adminController")




router.get('/login',(req,res)=>{
    res.render('admin/login')
})
router.get('/dashboard',(req,res)=>{
    res.render('admin/dashboard')
})
router.get('/forgetPassword',(req,res)=>{
    res.render('admin/forgetPassword')
})
router.get('/OTP',(req,res)=>{
    res.render('admin/OTP')
})
router.get('/changePassword',(req,res)=>{
    res.render('admin/changePassword')
})


router.post('/forgetPassword',adminController.forgetPassword)
router.post('/OTP',adminController.verifyOTP)
router.post('/resendOTP',adminController.resendOTP)
router.post('/changePassword',adminController.changePassword)
router.post('/login',adminController.login)
router.post('/dashbord',adminController.login)



module.exports=router