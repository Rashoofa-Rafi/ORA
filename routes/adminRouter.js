const express=require('express')
const router=express.Router()
const {upload}=require('../helpers/multer')
const {IsAdminAuthenticated,IsAdminLoggedOut} = require("../middleware/auth");
const nocache=require('../middleware/cache')
const adminController=require("../controller/adminController")
const customerController=require('../controller/customerController')
const categoryController=require('../controller/categoryController')
const subcategoryController=require('../controller/subcategoryController')
const productController=require('../controller/productController')


//for admin authentication

router.get('/login',IsAdminLoggedOut,nocache,adminController.loadLogin)
router.get('/dashboard',IsAdminAuthenticated,nocache,adminController.loadDashboard)
router.get('/forget-password',adminController.loadforgetPassword)
router.get('/otp',adminController.loadOTP)
router.get('/change-password',adminController.loadchangePassword)

router.post('/forget-password',adminController.forgetPassword)
router.post('/otp',adminController.verifyOTP)
router.post('/resend-otp',adminController.resendOTP)
router.post('/change-password',adminController.changePassword)
router.post('/login',adminController.login)





//for customer managemnent

router.get('/customers',IsAdminAuthenticated,nocache,customerController.customerInfo)
router.patch('/customers/block',IsAdminAuthenticated,nocache,customerController.blockStatus)

//for category management
router.get('/category',IsAdminAuthenticated,nocache,categoryController.categoryInfo)
router.post('/category/add',IsAdminAuthenticated,nocache,upload.single('image'),categoryController.addCategory)
router.patch('/category/edit/:id',IsAdminAuthenticated,nocache,upload.single('image'),categoryController.editCategory)
router.patch('/category/delete/:id',IsAdminAuthenticated,nocache,categoryController.deleteCategory)


//for subcategory management
router.get('/subcategory',IsAdminAuthenticated,nocache,subcategoryController.subcategoryInfo)
router.post('/subcategory/add',IsAdminAuthenticated,nocache,upload.single('image'),subcategoryController.addSubcategory)
router.patch('/subcategory/edit/:id',IsAdminAuthenticated,nocache,upload.single('image'),subcategoryController.editSubcategory)
router.patch('/subcategory/delete/:id',IsAdminAuthenticated,nocache,subcategoryController.deleteSubcategory)


//for product management

router.get('/products',IsAdminAuthenticated,nocache,productController.productInfo)
router.get('/add-product',IsAdminAuthenticated,nocache,productController.getaddProduct)
router.get('/edit-product/:id',IsAdminAuthenticated,nocache,productController.geteditProduct)
router.post('/products/add-product',IsAdminAuthenticated,nocache,upload.any(),productController.addProduct)


router.patch('/products/edit-product/:id',IsAdminAuthenticated,nocache,upload.any(),productController.editProduct)
router.patch('/products/delete/:id',IsAdminAuthenticated,nocache,productController.deleteProduct)





module.exports=router