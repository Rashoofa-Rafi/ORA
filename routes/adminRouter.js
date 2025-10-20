const express=require('express')
const router=express.Router()
const {upload}=require('../helpers/multer')
const adminController=require("../controller/adminController")
const customerController=require('../controller/customerController')
const categoryController=require('../controller/categoryController')
const {isAdminAuthenticated} = require('../middleware/adminAuth')
const nocache=require('../middleware/cache')
const subcategoryController=require('../controller/subcategoryController')


//for admin authentication

router.get('/login',(req,res)=>{
    res.render('admin/login')
})
router.get('/dashboard',isAdminAuthenticated,(req,res)=>{
    res.render('admin/dashboard')
})
router.get('/forgetPassword',(req,res)=>{
    res.render('admin/forgetPassword')
})
router.get('/OTP',(req,res)=>{
    res.render('admin/OTP')
})
router.get('/changePassword',nocache,(req,res)=>{
    res.render('admin/changePassword')
})

router.post('/forgetPassword',adminController.forgetPassword)
router.post('/OTP',adminController.verifyOTP)
router.post('/resendOTP',adminController.resendOTP)
router.post('/changePassword',adminController.changePassword)
router.post('/login',adminController.login)



//for customer managemnent

router.get('/customers',nocache,isAdminAuthenticated,customerController.customerInfo)
router.patch('/customers/block',isAdminAuthenticated,customerController.blockStatus)

//for category management
router.get('/category',nocache,isAdminAuthenticated,categoryController.categoryInfo)
router.post('/category/add',nocache,isAdminAuthenticated,upload.single('image'),categoryController.addCategory)
router.patch('/category/edit/:id',nocache,isAdminAuthenticated,upload.single('image'),categoryController.editCategory)
router.patch('/category/delete/:id',nocache,isAdminAuthenticated,categoryController.deleteCategory)


//for subcategory management
router.get('/subCategory',nocache,isAdminAuthenticated,subcategoryController.subcategoryInfo)
router.post('/subcategory/add',nocache,isAdminAuthenticated,upload.single('image'),subcategoryController.addSubcategory)
router.patch('/subcategory/edit/:id',nocache,isAdminAuthenticated,upload.single('image'),subcategoryController.editSubcategory)
router.patch('/subcategory/delete/:id',nocache,isAdminAuthenticated,subcategoryController.deleteSubcategory)








module.exports=router