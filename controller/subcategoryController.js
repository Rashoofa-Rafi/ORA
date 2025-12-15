const Subcategory=require('../models/subcategorySchema')
const Category=require('../models/categorySchema')
const HTTP_STATUS = require('../middleware/statusCode.js');
const AppError=require('../config/AppError')

const subcategoryInfo= async(req,res,next)=>{
    try {
        const search=req.query.search ||""
        const page=parseInt(req.query.page) || 1
        const limit=6

        let filter = {}
          if (search) {
             filter = { name: { $regex: '.*' + search + '.*', $options: 'i' }}
          }
        
        const subcategories=await Subcategory.find(filter)
        .sort({createdAt:-1})
        .populate('category_Id')
        .skip((page-1)*limit)
        .limit(limit)

        const categories = await Category.find({ isListed: true })
        const count=await Subcategory.countDocuments(filter)
        const totalPages = Math.ceil(count/limit)

        
        res.render('admin/subcategory',{
            subcategories,categories,search,page,totalPages
        })
} catch (error) {
    next(new AppError(err.message ,HTTP_STATUS.INTERNAL_SERVER_ERROR)) 
    }
}

let addSubcategory = async (req, res,next) => {
    
  try {
    const {category_Id}=req.body
    const name = req.body?.name?.trim()
    const description = req.body?.description?.trim()
    let image = req.file ? req.file.path : null
    

    if (!category_Id || !name || !description) {
      throw new AppError("All fields are required." ,HTTP_STATUS.BAD_REQUEST)
           
        }
    

    const existing = await Subcategory.findOne({name:{ $regex: `^${name}$`, $options: "i" }},category_Id)
    if (existing) {
      throw new AppError("Subcategory already exists!",HTTP_STATUS.BAD_REQUEST)
      
    }

    let newsubcategory = new Subcategory({
      category_Id,
      name,
      description,
      image,
      isListed: true
    })

    await newsubcategory.save()
    
   res.status(HTTP_STATUS.CREATED).json({ 
        success: true, 
        message: "Subcategory added successfully!" 
    })

  } catch (err) {
   next(new AppError(err.message ,HTTP_STATUS.INTERNAL_SERVER_ERROR))
  }
}

let editSubcategory = async (req, res,next) => {
  try {
    const { category_Id, name, description } = req.body

   
    if (!category_Id || !name || !description) {
      throw new AppError("All fields are required.",HTTP_STATUS.BAD_REQUEST)
      
    }

    
    const exist = await Subcategory.findOne({
      category_Id,
      name,
      _id: { $ne: req.params.id }
    })

    if (exist) {
      throw new AppError("Subcategory already exists in this category.",HTTP_STATUS.BAD_REQUEST)
    }

    
    const updateData = {
      name,
      description,
      category_Id
    }

    if (req.file) {
      updateData.image = req.file.filename
    }

    
    const updated = await Subcategory.findByIdAndUpdate(req.params.id, updateData, { new: true })

    if (!updated) {
      throw new AppError('Failed to update',HTTP_STATUS.BAD_REQUEST)
      
    }

    return res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: "Subcategory updated successfully!"
    })

  } catch (err) {
   next(new AppError(err.message ,HTTP_STATUS.INTERNAL_SERVER_ERROR))
  }
}


const deleteSubcategory = async (req, res,next) => {
  try {
   const subcategory= await Subcategory.findByIdAndUpdate(req.params.id, { isListed: false })
   if(!subcategory){
    throw new AppError('Failed to delete',HTTP_STATUS.BAD_REQUEST)
    
   }
     return res.status(HTTP_STATUS.CREATED).json({ 
        success: true, 
        message: "Subcategory removed from list" 
    })

  } catch (err) {
   next(new AppError(err.message ,HTTP_STATUS.INTERNAL_SERVER_ERROR))
  }
}


module.exports={subcategoryInfo,addSubcategory,editSubcategory,deleteSubcategory}