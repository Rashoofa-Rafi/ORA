const Subcategory=require('../models/subcategorySchema')
const Category=require('../models/categorySchema')


const subcategoryInfo= async(req,res)=>{
    try {
        const search=req.query.search ||""
        const page=parseInt(req.query.page) || 1
        const limit=2

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
    console.error(error)
    res.status(500).json({
        success:false,
        message:'internal server error'
    })
        
    }
}

let addSubcategory = async (req, res) => {
    
  try {
    const {category_Id}=req.body
    const name = req.body?.name?.trim()
    const description = req.body?.description?.trim()
    let image = req.file ? req.file.filename : ""
    console.log(name,description,image)

    if (!category_Id || !name || !description) {
            return res.json({ 
              success: false, 
              message: "All fields are required." 
            })
        }
    

    const existing = await Subcategory.findOne({name:{ $regex: `^${name}$`, $options: "i" }},category_Id)
    if (existing) {
        
      return res.status(400).json({ 
        success: false, 
        message: "Subcategory already exists!"})
    }

    let newsubcategory = new Subcategory({
      category_Id,
      name,
      description,
      image,
      isListed: true
    })

    await newsubcategory.save()
    

    console.log(newsubcategory)
    res.status(200).json({ 
        success: true, 
        message: "Subcategory added successfully!" 
    })

  } catch (err) {
    console.error(err);
    
    res.status(500).json({ 
        success: false, 
        message: 'internal server error' 
    })
  }
}

let editSubcategory = async (req, res) => {
  try {
    const { category_Id, name, description } = req.body

   
    if (!category_Id || !name || !description) {
      return res.status(400).json({
        success: false,
        message: "All fields are required."
      })
    }

    
    const exist = await Subcategory.findOne({
      category_Id,
      name,
      _id: { $ne: req.params.id }
    })

    if (exist) {
      return res.status(400).json({
        success: false,
        message: "Subcategory already exists in this category."
      })
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
      return res.status(400).json({
        success: false,
        message: "Failed to update subcategory."
      })
    }

    return res.status(200).json({
      success: true,
      message: "Subcategory updated successfully!"
    })

  } catch (err) {
    console.error(err)
    res.status(500).json({
      success: false,
      message: "Internal server error"
    })
  }
}


const deleteSubcategory = async (req, res) => {
  try {
   const subcategory= await Subcategory.findByIdAndUpdate(req.params.id, { isListed: false })
   if(!subcategory){
    return res.status(400).json({
        success:false,
        message:'Failed to delete'
    })
   }
     return res.status(200).json({ 
        success: true, 
        message: "Subcategory removed from list" 
    })

  } catch (err) {
    console.error(err);
    res.status(500).json({ 
        success: false, 
        message: "Internal server error" 
    })
  }
}


module.exports={subcategoryInfo,addSubcategory,editSubcategory,deleteSubcategory}