const express=require("express")
const router=express.Router()
const userController=require('../controller/userController')



router.get('/landinghome',userController.loadlandingHome)
router.get('/pageNotFound',userController.pageNotFound)




module.exports=router