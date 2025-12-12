const express=require('express')
const router=express.Router()
const {upload}=require('../helpers/multer')
const {adminIsAuthenticated,adminIsLoggedOut} = require("../middleware/auth");
const nocache=require('../middleware/cache')
const adminController=require("../controller/adminController")
const customerController=require('../controller/customerController')
const categoryController=require('../controller/categoryController')
const subcategoryController=require('../controller/subcategoryController')
const productController=require('../controller/productController')


//for admin authentication

router.get('/login',adminIsLoggedOut,nocache,adminController.loadLogin)
router.get('/dashboard',adminIsAuthenticated,nocache,adminController.loadDashboard)
router.get('/forget-password',adminController.loadforgetPassword)
router.get('/otp',adminController.loadOTP)
router.get('/change-password',adminController.loadchangePassword)

router.post('/forget-password',adminController.forgetPassword)
router.post('/otp',adminController.verifyOTP)
router.post('/resend-otp',adminController.resendOTP)
router.post('/change-password',adminController.changePassword)
router.post('/login',adminController.login)





//for customer managemnent

router.get('/customers',adminIsAuthenticated,nocache,customerController.customerInfo)
router.patch('/customers/block',adminIsAuthenticated,nocache,customerController.blockStatus)

//for category management
router.get('/category',adminIsAuthenticated,nocache,categoryController.categoryInfo)
router.post('/category/add',adminIsAuthenticated,nocache,upload.single('image'),categoryController.addCategory)
router.patch('/category/edit/:id',adminIsAuthenticated,nocache,upload.single('image'),categoryController.editCategory)
router.patch('/category/delete/:id',adminIsAuthenticated,nocache,categoryController.deleteCategory)


//for subcategory management
router.get('/subcategory',adminIsAuthenticated,nocache,subcategoryController.subcategoryInfo)
router.post('/subcategory/add',adminIsAuthenticated,nocache,upload.single('image'),subcategoryController.addSubcategory)
router.patch('/subcategory/edit/:id',adminIsAuthenticated,nocache,upload.single('image'),subcategoryController.editSubcategory)
router.patch('/subcategory/delete/:id',adminIsAuthenticated,nocache,subcategoryController.deleteSubcategory)


//for product management

router.get('/products',adminIsAuthenticated,nocache,productController.productInfo)
router.get('/add-product',adminIsAuthenticated,nocache,productController.getaddProduct)
router.get('/edit-product/:id',adminIsAuthenticated,nocache,productController.geteditProduct)
router.post('/products/add-product',adminIsAuthenticated,nocache,upload.any(),productController.addProduct)


router.patch('/products/edit-product/:id',adminIsAuthenticated,nocache,upload.any(),productController.editProduct)
router.patch('/products/delete/:id',adminIsAuthenticated,nocache,productController.deleteProduct)





module.exports=router