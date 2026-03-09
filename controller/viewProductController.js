const Product = require('../models/productSchema')
const Variant = require('../models/varientSchema')
const Category=require('../models/categorySchema')
const Subcategory=require('../models/subcategorySchema')
const Offer=require('../models/offerSchema.js')
const { calculateItemPrice } = require('../config/offerCalculator')
const HTTP_STATUS = require('../middleware/statusCode.js');
const AppError=require('../config/AppError')
const BRAND_OPTIONS = ['CASIO','TITAN','FOSSIL','FASTRACK','ROLEX','NAVIFORCE','OTHERS']
const MATERIAL_OPTIONS = ['Metal','Rubber','Leather']
const DIALTYPE_OPTIONS = ['Analogue','Digital']
const listProducts = async (req, res, next) => {
  try {
    let {search,category,subcategory,brand,material,dialType,sort,page,} = req.query;
    page = parseInt(page) || 1;
    const limit = 8;
    const skip = (page - 1) * limit;

    const filter = { isListed: true };

    if (search && search.trim() !== "") {
      filter.productname = { $regex: search.trim(), $options: "i" };
    }

    if (category && category !== "all") {
      const categoryDoc = await Category.findOne({
        name: category,
        isListed: true,
      });
      filter.category_Id = categoryDoc ? categoryDoc._id : null;
    }

    if (subcategory && subcategory !== "all") {
      const subcategoryDoc = await Subcategory.findOne({
        name: subcategory,
        isListed: true,
      });
      filter.subcategory_Id = subcategoryDoc ? subcategoryDoc._id : null;
    }
    
    if (brand) filter.brand = brand;
    if (material) filter.material = material;
    if (dialType) filter.dialType = dialType;

    const variantPriceMatch = {};
    if (req.query.priceRange) {
      const [min, max] = req.query.priceRange.split("-").map(Number);
      if (!isNaN(min)) variantPriceMatch.$gte = min;
      if (!isNaN(max)) variantPriceMatch.$lte = max;
    }
    const now = new Date()
    const pipeline = [
      { $match: filter },
      {
        $lookup: {
          from: "variants",
          localField: "_id",
          foreignField: "product_id",
          as: "variants",
        },
      },
      { $unwind: "$variants" },
      ...(req.query.priceRange ? [{ $match: { "variants.price": variantPriceMatch } }] : []),
      {
        $group: {
          _id: "$_id",
          productname: { $first: "$productname" },
          description: { $first: "$description" },
          brand: { $first: "$brand" },
          category_Id: { $first: "$category_Id" },
          firstVariant: { $first: "$variants" },
        },
      },
      ...(sort === "low-high"
        ? [{ $sort: { "firstVariant.price": 1 } }]
        : sort === "high-low"
        ? [{ $sort: { "firstVariant.price": -1 } }]
        : sort === "a-z"
        ? [{ $sort: { productname: 1 } }]
        : sort === "z-a"
        ? [{ $sort: { productname: -1 } }]
        : []),
    ];

    const totalResult = await Product.aggregate(pipeline);
    const totalProducts = totalResult.length;
    const totalPages = Math.ceil(totalProducts / limit);

    // Pagination
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: limit });

    const productsData = await Product.aggregate(pipeline);
    const productsForUser = await Promise.all(
      productsData.map(async (p) => {
        const variant = p.firstVariant;
        if (!variant) return null;

        const priceData = await calculateItemPrice(p, variant, p.category_Id);

        return {
          _id: p._id,
          name: p.productname,
          description: p.description,
          mainImage: variant?.images?.[0],
          price: priceData.finalPrice,
          originalPrice: priceData.discountAmount ? priceData.basePrice : null,
          offerPercentage: priceData.discountAmount
            ? Math.round((priceData.discountAmount / priceData.basePrice) * 100)
            : null,
          brand: p.brand,
          variantId: variant?._id,
        };
      })
    );

    return res.render("user/allproduct", {
      products: productsForUser,
      totalPages,
      currentPage: page,
      query: req.query,
      category,
      subcategory,
      noResults: productsForUser.length === 0,
      brandOptions: BRAND_OPTIONS,
      materialOptions: MATERIAL_OPTIONS,
      dialTypeOptions: DIALTYPE_OPTIONS,
    });
    
  } catch (err) {
    next(new AppError(err.message, HTTP_STATUS.INTERNAL_SERVER_ERROR));
  }
};


const getProductDetails = async (req, res,next) => {
  try {
    const productId = req.params.id;
    const selectedVariantId = req.query.variant

    const product = await Product.findById(productId)
    .populate('category_Id')
    .populate('subcategory_Id')

    if (!product) return res.status(404).send("Product not found");
    const variants = await Variant.find({ product_id: productId });

    if (!variants.length) {
      return res.status(404).send("No variants available for this product");
    }

   let activeVariant;

    if (selectedVariantId) {
      activeVariant = variants.find(v => v._id.toString() === selectedVariantId);
    }
    if (!activeVariant) {
      activeVariant = variants[0];
    }
    const priceData = await calculateItemPrice(product, activeVariant, product.category_Id._id);

    //  Prepare structured response
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
        price: priceData.finalPrice,
        images: activeVariant.images,
        stock: activeVariant.stock
      },
      activeOffer: priceData.appliedOffer
        ? {
            type: priceData.appliedOffer.type,
            discountedPrice: priceData.finalPrice,
            originalPrice: priceData.basePrice,
            percentage: priceData.appliedOffer.discountType === 'PERCENTAGE'
              ? priceData.appliedOffer.discountValue
              : Math.round((priceData.appliedOffer.discountValue / priceData.basePrice) * 100),
          }
        : null,
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

// RELATED PRODUCTS - same subcategory, exclude current product
const relatedProducts = await Product.find({
    subcategory_Id: product.subcategory_Id,
    _id: { $ne: product._id },
    isListed: true
})
.populate({
    path: "variants",
      
})
.limit(4); 

    return res.render("user/product-details", 
      { product:productData ,
        query:req.query,
        breadcrumb,
        relatedProducts
      });

  } catch (err) {
     next(new AppError(err.message ,HTTP_STATUS.INTERNAL_SERVER_ERROR))
  }
};

module.exports = { 
  listProducts ,
  getProductDetails
};
