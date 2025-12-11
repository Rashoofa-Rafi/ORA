const Product = require('../models/productSchema')
const Variant = require('../models/varientSchema')
const Category=require('../models/categorySchema')
const Subcategory=require('../models/subcategorySchema')
const BRAND_OPTIONS = ['CASIO','TITAN','FOSSIL','FASTRACK','ROLEX','NAVIFORCE','OTHERS']
const MATERIAL_OPTIONS = ['Metal','Rubber','Leather']
const DIALTYPE_OPTIONS = ['Analogue','Digital']
const listProducts = async (req, res) => {
  try {
    let {
      search,
      category,
      subcategory,
      brand,
      material,
      dialType,
      sort,
      page,
    } = req.query;

    page = parseInt(page) || 1;
    const limit = 8;
    const skip = (page - 1) * limit;

    const filter = {isListed:true };

    if (search && search.trim() !== "") filter.productname = { $regex: search.trim(), $options: "i" };
    
    if (category && category !== "all") {
      const categoryDoc = await Category.findOne({ name: req.query.category  });
      if (categoryDoc) {
        filter.category_Id = categoryDoc._id;
      }
    }

    
    if (subcategory && subcategory !== "all") {
      const subcategoryDoc = await Subcategory.findOne({ name: req.query.subcategory  });
      if (subcategoryDoc) {
        filter.subcategory_Id = subcategoryDoc._id;
      }
    }

    if (brand) filter.brand = brand;
    if (material) filter.material = material;
    if (dialType) filter.dialType = dialType;
    let priceFilter = {};
if (req.query.priceRange) {
  const [min, max] = req.query.priceRange.split("-");
  priceFilter = max 
      ? { $gte: Number(min), $lte: Number(max) } 
      : { $gte: Number(min) };
}


    let sortQuery = {};
    switch (sort) {
      case "low-high": sortQuery.price = 1; break;
      case "high-low": sortQuery.price = -1; break;
      case "a-z": sortQuery.productname = 1; break;
      case "z-a": sortQuery.productname = -1; break;
    }



    const totalProducts = await Product.countDocuments(filter);

    const productsData = await Product.find(filter)
    .populate("category_Id")
  .populate("subcategory_Id")
    .populate({
      path: "variants",
      match: Object.keys(priceFilter).length > 0 ? { price: priceFilter } : {}
  })
      .sort(sortQuery)
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(totalProducts / limit);

    // map properly
    const productsForUser = productsData.map(p => {
      const firstVariant = p.variants?.[0];

      return {
        _id: p._id,
        name: p.productname,
        description: p.description,
        mainImage: firstVariant?.images?.[0],
        price: firstVariant?.price,
        brand: p.brand
      }
    })


    return res.render("user/allProduct", {
      products: productsForUser,
      totalPages,
      currentPage: page,
      query: req.query,
      category,
      subcategory,
      brandOptions: BRAND_OPTIONS,
      materialOptions: MATERIAL_OPTIONS,
      dialTypeOptions: DIALTYPE_OPTIONS,
    });

  } catch (err) {
    console.error( err);
    return res.status(500).json({
      success:false,
      message:"Server Error"
    })
  }
}

const getProductDetails = async (req, res) => {
  try {
    const productId = req.params.id;
    const selectedVariantId = req.query.variant; // optional query param

    // 1️⃣ Fetch product data
    const product = await Product.findById(productId)
    .populate('category_Id')
    .populate('subcategory_Id')

    if (!product) return res.status(404).send("Product not found");

    // 2️⃣ Fetch variants separately because they are in different collection
    const variants = await Variant.find({ product_id: productId });

    if (!variants.length) {
      return res.status(404).send("No variants available for this product");
    }

    // 3️⃣ Determine active variant
    let activeVariant;

    if (selectedVariantId) {
      activeVariant = variants.find(v => v._id.toString() === selectedVariantId);
    }

    // default → the first one
    if (!activeVariant) {
      activeVariant = variants[0];
    }

    // 4️⃣ Prepare structured response
    const productData = {
      id: product._id,
      name: product.productname,
      description: product.description,
      variants: variants.map(v => ({
        id: v._id,
        color: v.color,
        price: v.price,
        images: v.images,
        stock: v.stock
      })),
      activeVariant: {
        id: activeVariant._id,
        color: activeVariant.color,
        price: activeVariant.price,
        images: activeVariant.images,
        stock: activeVariant.stock
      }
    };
   const breadcrumb = [
  { name: "Home", url: "/user/allproduct" },
  product.category_Id && {
      name: product.category_Id.name,
      url: `/user/allproduct?category=${product.category_Id._id}`
  },
  product.subcategory_Id && {
      name: product.subcategory_Id.name,
      url: `/user/allproduct?subcategory=${product.subcategory_Id._id}`
  },
  { name: product.productname, url: null }
].filter(Boolean);


    return res.render("user/product-details", 
      { product:productData ,
        query:req.query,
        breadcrumb
      });

  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
};

module.exports = { 
  listProducts ,
  getProductDetails
};
