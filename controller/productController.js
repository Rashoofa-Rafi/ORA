const Product=require('../models/productSchema')
const Category=require('../models/categorySchema')
const Subcategory=require('../models/subcategorySchema')

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
           products,search,totalPages,page,categories,subcategories
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
        const brands=['CASIO','TITAN','FOSSIL','FASTRACK','ROLEX','NAVIFORCE','OTHERS']
        const materials=['Metal','Rubber','Leather']
        const dials=['Analogue','Digital']

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
      price,
      variantPrice,
      variantStock,
      variantColor
    } = req.body
const hasVariant = req.body.hasVariant === "true"

    if (!productname || !description || !category || !subcategory || !brand || !material || !dialType || !price) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    
    
    if (!req.files || !req.files.productImages || (req.files.productImages.length < 3)) {
      return res.status(400).json({
        success: false,
        message: 'Please upload at least 3 product images'
      });
    }
    const productImages = req.files?.productImages?.map(file => `/uploads/products/${file.filename}`) || []
    const product = await Product.create({
      productname,
      description,
      category_Id,
      subcategory_Id,
      brand,
      material,
      dialType,
      price,
      productImages
    })

    if (hasVariant ) {
      const variantImages = req.files?.variantImages?.map(file => `/uploads/variants/${file.filename}`) || [];
console.log('!variantPrice', !variantPrice);
    console.log('!variantStock ', !(variantStock ));
    console.log('!variantColor', !(variantColor));
    console.log('variantImages.length < 3)', (variantImages.length < 3));
      if (!variantPrice || !variantStock || !variantColor || variantImages.length < 3) {
        return res.status(400).json({
          success: false,
          message: 'Please provide all variant details correctly.'
        });
      }


      await Variant.create({
        product_id: product._id, 
        price: variantPrice,
        stock: variantStock,
        color: variantColor,
        image: variantImages,
        sku: `SKU-${Date.now()}`
      });
    }
    return res.status(200).json({
      success: true,
      message: 'Product added successfully',
      redirect: '/admin/products'
    })

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

const editProduct=async(req,res)=>{
    try {
        
    } catch (error) {
        
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
    editProduct,
    deleteProduct
}