const Category=require('../models/categorySchema')


const categoryInfo= async(req,res)=>{
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
            categories,search,page,totalPages
        })
} catch (error) {
    console.error(error)
    res.status(500).json({
        success:false,
        message:'internal server error'
    })
        
    }
}

let addCategory = async (req, res) => {
    
  try {
    
    const name = req.body?.name?.trim()
    const description = req.body?.description?.trim()
    let image = req.file ? req.file.filename : ""
console.log(name,description,image)
    

    const existing = await Category.findOne({name:{ $regex: `^${name}$`, $options: "i" }})
    if (existing) {
        
      return res.status(400).json({ 
        success: false, 
        message: "Category already exists!"})
    }

    let newCategory = new Category({
      name,
      description,
      image,
      isListed: true
    })

    await newCategory.save()
    

    console.log(newCategory)
    res.status(200).json({ 
        success: true, 
        message: "Category added successfully!" 
    })

  } catch (err) {
    console.error(err);
    
    res.status(500).json({ 
        success: false, 
        message: 'internal server error'
    })
  }
}

let editCategory = async (req, res) => {
  try {
    const { name, description } = req.body
    const updateData = { name, description }

    if (req.file) {
      updateData.image = req.file.filename
    }

    const category=await Category.findByIdAndUpdate(req.params.id, updateData)
    if(!category){
        return res.status(400).json({
            success:false,
            message:'Failed to Update category'
        })
    }
    return res.status(200).json({ 
        success: true, 
        message: "Category updated successfully!"
     })

  } catch (err) {
    console.error(err)
    res.status(500).json({ 
        success: false, 
        message: "Internal server error" 
    })
  }
}

const deleteCategory = async (req, res) => {
  try {
   const category= await Category.findByIdAndUpdate(req.params.id, { isListed: false })
   if(!category){
    return res.status(400).json({
        success:false,
        message:'Failed to delete'
    })
   }
     return res.status(200).json({ 
        success: true, 
        message: "Category removed from list" 
    })

  } catch (err) {
    console.error(err);
    res.status(500).json({ 
        success: false, 
        message: "Internal server error" 
    })
  }
}


module.exports={categoryInfo,addCategory,editCategory,deleteCategory}