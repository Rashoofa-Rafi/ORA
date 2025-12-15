const Category=require('../models/categorySchema')
const HTTP_STATUS=require('../middleware/statusCode')
const AppError=require('../config/AppError')
const categoryInfo= async(req,res,next)=>{
    try {
        const search=req.query.search ||""
        const page=parseInt(req.query.page) || 1
        const limit=2

        let filter = {}
          if (search) {
             filter = { name: { $regex: '.*' + search + '.*', $options: 'i' }}
          }
        
        const categories=await Category.find(filter)
        .sort({createdAt:-1})
        .skip((page-1)*limit)
        .limit(limit)


        const count=await Category.countDocuments(filter)
        const totalPages = Math.ceil(count/limit)

        console.log(categories)
        res.render('admin/category',{
            categories,
            search,
            page,
            totalPages,
            currentPath: req.path
        })
        
} catch (err) {
    next(new AppError(err.message ,HTTP_STATUS.INTERNAL_SERVER_ERROR))
        }
}

let addCategory = async (req, res,next) => {
    
  try {
    
    const name = req.body?.name?.trim()
    const description = req.body?.description?.trim()
    let image = req.file ? req.file.path: null

    const existing = await Category.findOne({name:{ $regex: `^${name}$`, $options: "i" }})
    if (existing) {
      throw new AppError('Category already exists',HTTP_STATUS.BAD_REQUEST)  
      
    }

    let newCategory = new Category({
      name,
      description,
      image,
      isListed: true
    })

    await newCategory.save()
    res.status(HTTP_STATUS.CREATED).json({ 
        success: true, 
        message: "Category added successfully!" 
    })

  } catch (err) {
    next(new AppError(err.message ,HTTP_STATUS.INTERNAL_SERVER_ERROR))
  }
}

let editCategory = async (req, res,next) => {
  try {
    const { name, description } = req.body
    const updateData = { name, description }

    if (req.file) {
      updateData.image = req.file.filename
    }

    const category=await Category.findByIdAndUpdate(req.params.id, updateData)
    if(!category){
      throw new AppError('Failed to Update category',HTTP_STATUS.BAD_REQUEST) 
        
    }
    return res.status(HTTP_STATUS.CREATED).json({ 
        success: true, 
        message: "Category updated successfully!"
     })

  } catch (err) {
     next(new AppError(err.message ,HTTP_STATUS.INTERNAL_SERVER_ERROR))
  }
}

const deleteCategory = async (req, res,next) => {
  try {
   const category= await Category.findByIdAndUpdate(req.params.id, { isListed: false })
   if(!category){
    throw new AppError('Category not found',HTTP_STATUS.BAD_REQUEST)
   }
     return res.status(HTTP_STATUS.CREATED).json({ 
        success: true, 
        message: "Category removed from list" 
    })

  } catch (err) {
     next(new AppError(err.message ,HTTP_STATUS.INTERNAL_SERVER_ERROR))
  }
}


module.exports={categoryInfo,addCategory,editCategory,deleteCategory}