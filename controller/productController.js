const Product=require('../models/productSchema')
const Variant=require('../models/varientSchema')
const Category=require('../models/categorySchema')
const Subcategory=require('../models/subcategorySchema')
const cloudinary = require("../config/cloudinary");
const fs = require("fs");

const productInfo=async(req,res)=>{
    try {
        let search=req.query.search ||''
        let page=parseInt(req.query.page) || 1
        let limit =6

        let filter={}
        if(search){
            filter={name:{$regex:'.*' +search+'.*',$options:'i'}}
        }

        const products=await Product.find(filter)
        .populate("category_Id")
        .populate("subcategory_Id")
        .sort({createdAt:-1})
        .skip((page-1)*limit)
        .limit(limit)
        
        const count=await Product.countDocuments(filter)
        const totalPages=Math.ceil(count/limit)

        const categories=await Category.find({isListed:true})
        const subcategories=await Subcategory.find({isListed:true})

        res.render('admin/product',{
           products,search,totalPages,page,categories,subcategories,currentPath: req.path
        })
            
        
    } catch (error) {
        console.error(error)
        res.status(500).json({
            success:false,
            message:'server error'
        })
        
    }
}
const getaddProduct= async(req,res)=>{
    try {
        const categories=await Category.find({isListed:true})
        const subcategories= await Subcategory.find({isListed:true})
        const brands=['CASIO','TITAN','FOSSIL','FASTRACK','ROLEX','NAVIFORCE','DANIEL KLEIN','OTHERS']
        const materials=['Metal','Rubber','Leather']
        const dials=['Analogue','Digital',"Smart"]

        res.render('admin/add-product',{
            categories,
            subcategories,
            brands,
            materials,
            dials

        })
    } catch (error) {
        console.error(error)
        res.status(500).send('internal server error')
    }
}
const addProduct = async (req, res) => {
  try {
    const {
      productname,
      description,
      category_Id,
      subcategory_Id,
      brand,
      material,
      dialType,
      variants
    } = req.body;
    if (!productname || !description || !category_Id || !subcategory_Id || !brand || !material || !dialType) {
      return res.status(400).json({ 
        success: false,
        message: 'All product fields are required' })
    }

    // parse variants JSON
    let variantArray = [];
    try {
      variantArray = JSON.parse(variants || "[]");
    } catch (err) {
      return res.status(400).json({ success: false, message: "Invalid variants payload" });
    }

    if (!Array.isArray(variantArray) || variantArray.length === 0) {
      return res.status(400).json({ success: false, message: "At least one variant required" });
    }

    const product = await Product.create({
      productname,
      description,
      category_Id,
      subcategory_Id,
      brand,
      material,
      dialType
    })

    // Group Cloudinary files by fieldnames
   
    const filesByField = {};
    (req.files || []).forEach(f => {
      if (!filesByField[f.fieldname]) filesByField[f.fieldname] = [];
      filesByField[f.fieldname].push(f);
    });

    const createdVariantIds = [];

    // ----- create variants -----
    for (let i = 0; i < variantArray.length; i++) {
      const v = variantArray[i];

      // validate
      if (!v.price || isNaN(v.price) || Number(v.price) <= 0) {
        return res.status(400).json({ success: false, message: `Invalid price for variant ` });
      }
      if (v.stock == null || isNaN(v.stock) || Number(v.stock) < 0) {
        return res.status(400).json({ success: false, message: `Invalid stock for variant ` });
      }
      if (!v.color) {
        return res.status(400).json({ success: false, message: `please select a color for variant ` });
      }

      const fieldName = `variantImages_${i}`;
      const uploadedFiles = filesByField[fieldName] || [];

      if (uploadedFiles.length < 3) {
        return res.status(400).json({ success: false, message: `Variant requires at least 3 images` });
      }

      // Cloudinary returns file.path = secure_url
      const imageURLs = uploadedFiles.map(img => img.path);

      // generate SKU
      const sku = `SKU-${product._id.toString().slice(-6)}-${i+1}-${Date.now().toString().slice(-4)}`;

      const created = await Variant.create({
        product_id: product._id,
        price: Number(v.price),
        stock: Number(v.stock),
        color: v.color,
        images: imageURLs,
        sku
      });

      createdVariantIds.push(created._id);
    }

    // attach variants
    product.variants = createdVariantIds;
    // calculate total stock
const totalStock = await Variant.aggregate([
  { $match: { product_id: product._id } },
  { $group: { _id: null, total: { $sum: "$stock" } } }
]);

product.totalStock = totalStock[0]?.total || 0;

    await product.save();
    return res.json({
      success: true,
      message: "Product added successfully",
      redirect1: "/admin/products"
    });

  } catch (error) {
    console.error( error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

 const geteditProduct=async(req,res) =>{
  try {
    const productId = req.params.id;
    const product = await Product.findById(productId)
            .populate("variants")
            .populate("category_Id")
            .populate("subcategory_Id")
            
    if (!product) {
            return res.status(400).json({
              success:false,
              message:"Product not found"});
        }

        // Fetch dropdown lists
        const categories = await Category.find()
        const subcategories = await Subcategory.find()
        const brands=['CASIO','TITAN','FOSSIL','FASTRACK','ROLEX','NAVIFORCE','OTHERS']
        const materials=['Metal','Rubber','Leather']
        const dials=['Analogue','Digital']

        return res.render("admin/edit-product", {
            product,
            categories,
            subcategories,
            brands,
            materials,
            dials,
        })
  } catch (error) {
    console.error(error)
    return res.status(500).json({
      success:false,
      message:'Internal server error'
    })
  }
 }


const editProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    const variants = JSON.parse(req.body.variants)
     
    await Product.findByIdAndUpdate(productId, {
      productname: req.body.productname,
      description: req.body.description,
      category_Id: req.body.category_Id,
      subcategory_Id: req.body.subcategory_Id,
      brand: req.body.brand,
      material: req.body.material,
      dialType: req.body.dialType
    });

    // Update each existing variant individually
    for (const v of variants) {
      await Variant.findByIdAndUpdate(
        v._id,
        {
          color: v.color,
          price: v.price,
          stock: v.stock,
          status: v.stock > 0 ? "available" : "out of stock"
        },
        { new: true }
      );
    }

    return res.status(200).json({ 
      success: true,
      message:'Updated successfully' 
    })

  } catch (err) {
    console.log(err)
    return res.status(500).json({ 
      success:false,
      message: "Server error"
     })
  }
}

const deleteProduct=async(req,res)=>{
    try {
        const productId=req.params.id
        const updated = await Product.findByIdAndUpdate(productId,{ isListed: false })

    if (!updated) {
      return res.status(400).json({
        success: false,
        message: "Failed to delete product",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Product deleted successfully",
    });
        

        
    } catch (error) {
        console.error(error)
        return res.status(500).json({
            success:false,
            message:'Internal server error'
        })
        
    }
}


module.exports={
    productInfo,
    getaddProduct,
    addProduct,
    geteditProduct,
    editProduct,
    deleteProduct
}