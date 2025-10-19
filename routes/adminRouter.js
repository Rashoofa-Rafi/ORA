const express=require('express')
const router=express.Router()
const {upload}=require('../helpers/multer')
const adminController=require("../controller/adminController")
const customerController=require('../controller/customerController')
const categoryController=require('../controller/categoryController')
const subcategoryController=require('../controller/subcategoryController')


//for admin authentication

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


//for customer managemnent

router.get('/customers',customerController.customerInfo)
router.patch('/customers/block',customerController.blockStatus)

//for category management
router.get('/category',categoryController.categoryInfo)
router.post('/category/add',upload.single('image'),categoryController.addCategory)
router.patch('/category/edit/:id',upload.single('image'),categoryController.editCategory)
router.patch('/category/delete/:id',categoryController.deleteCategory)


//for subcategory management
router.get('/subCategory',subcategoryController.subcategoryInfo)
router.post('/subcategory/add',upload.single('image'),subcategoryController.addSubcategory)
router.patch('/subcategory/edit/:id',upload.single('image'),subcategoryController.editSubcategory)
router.patch('/subcategory/delete/:id',subcategoryController.deleteSubcategory)








module.exports=router