const express=require('express')
const router=express.Router()
const {upload}=require('../helpers/multer')
const {isAdminAuthenticated} = require('../middleware/adminAuth')
const nocache=require('../middleware/cache')
const adminController=require("../controller/adminController")
const customerController=require('../controller/customerController')
const categoryController=require('../controller/categoryController')
const subcategoryController=require('../controller/subcategoryController')
const productController=require('../controller/productController')


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


//for product management

router.get('/products',productController.productInfo)
router.get('/add-product',productController.getaddProduct)
router.get('/edit-product/:id',productController.geteditProduct)
router.post('/products/add-product',upload.any(),productController.addProduct)


router.patch('/products/edit-product/:id',upload.any(),productController.editProduct)
router.patch('/products/delete/:id',productController.deleteProduct)





module.exports=router