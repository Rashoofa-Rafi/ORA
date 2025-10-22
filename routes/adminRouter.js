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

router.get('/login',adminController.loadLogin)
router.get('/dashboard',adminController.loadDashboard)
router.get('/forget-password',adminController.loadforgetPassword)
router.get('/otp',adminController.loadOTP)
router.get('/change-password',adminController.loadchangePassword)

router.post('/forget-password',adminController.forgetPassword)
router.post('/otp',adminController.verifyOTP)
router.post('/resend-otp',adminController.resendOTP)
router.post('/change-password',adminController.changePassword)
router.post('/login',adminController.login)





//for customer managemnent

router.get('/customers',customerController.customerInfo)
router.patch('/customers/block',customerController.blockStatus)

//for category management
router.get('/category',categoryController.categoryInfo)
router.post('/category/add',upload.single('image'),categoryController.addCategory)
router.patch('/category/edit/:id',upload.single('image'),categoryController.editCategory)
router.patch('/category/delete/:id',categoryController.deleteCategory)


//for subcategory management
router.get('/subcategory',subcategoryController.subcategoryInfo)
router.post('/subcategory/add',upload.single('image'),subcategoryController.addSubcategory)
router.patch('/subcategory/edit/:id',upload.single('image'),subcategoryController.editSubcategory)
router.patch('/subcategory/delete/:id',subcategoryController.deleteSubcategory)








module.exports=router