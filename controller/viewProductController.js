const Product = require('../models/productSchema')
const Variant = require('../models/varientSchema')
const Category=require('../models/categorySchema')
const Subcategory=require('../models/subcategorySchema')
const Offer=require('../models/offerSchema.js')
const HTTP_STATUS = require('../middleware/statusCode.js');
const AppError=require('../config/AppError')
const BRAND_OPTIONS = ['CASIO','TITAN','FOSSIL','FASTRACK','ROLEX','NAVIFORCE','OTHERS']
const MATERIAL_OPTIONS = ['Metal','Rubber','Leather']
const DIALTYPE_OPTIONS = ['Analogue','Digital']
const listProducts = async (req, res, next) => {
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
    ];

    // Price filter
    if (req.query.priceRange) {
      pipeline.push({
        $match: {
          "variants.price": variantPriceMatch,
        },
      });
    }

    // Group (FIRST variant only — no sorting before this)
    pipeline.push({
      $group: {
        _id: "$_id",
        productname: { $first: "$productname" },
        description: { $first: "$description" },
        brand: { $first: "$brand" },
        firstVariant: { $first: "$variants" },
      },
    });

    // Product-level sorting
    if (sort === "low-high") {
      pipeline.push({ $sort: { "firstVariant.price": 1 } });
    } else if (sort === "high-low") {
      pipeline.push({ $sort: { "firstVariant.price": -1 } });
    } else if (sort === "a-z") {
      pipeline.push({ $sort: { productname: 1 } });
    } else if (sort === "z-a") {
      pipeline.push({ $sort: { productname: -1 } });
    }

    // Count after filters
    const totalResult = await Product.aggregate(pipeline);
    const totalProducts = totalResult.length;
    const totalPages = Math.ceil(totalProducts / limit);

    // Pagination
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: limit });

    const productsData = await Product.aggregate(pipeline);

    const productsForUser = productsData.map((p) => ({
      _id: p._id,
      name: p.productname,
      description: p.description,
      mainImage: p.firstVariant?.images?.[0], // first variant image
      price: p.firstVariant?.price,
      brand: p.brand,
      variantId: p.firstVariant?._id,
    }));

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
    next(new AppError(err.message, HTTP_STATUS.INTERNAL_SERVER_ERROR));
  }
};


const getProductDetails = async (req, res,next) => {
  try {
    const productId = req.params.id;
    const selectedVariantId = req.query.variant

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
     const basePrice = activeVariant.price;

    // 4️⃣ Calculate active offer
    const now = new Date();
    let activeOffer = null;
    let finalPrice = basePrice;

    // PRODUCT OFFER (priority)
    const productOffer = await Offer.findOne({
      type: "PRODUCT",
      productId: product._id,
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
    });
    if (productOffer) {
      if (productOffer.discountType === "PERCENTAGE") {
        finalPrice = basePrice - (basePrice * productOffer.discountValue) / 100;
      } else {
        finalPrice = basePrice - productOffer.discountValue;
      }
      activeOffer = {
        type: "product",
        percentage:
          productOffer.discountType === "PERCENTAGE"
            ? productOffer.discountValue
            : Math.round((productOffer.discountValue / basePrice) * 100),
        discountedPrice: finalPrice,
        originalPrice: basePrice,
      };
    } else {
      // CATEGORY OFFER (fallback)
      const categoryOffer = await Offer.findOne({
        type: "CATEGORY",
        categoryId: product.category_Id._id,
        isActive: true,
        startDate: { $lte: now },
        endDate: { $gte: now },
      });

      if (categoryOffer) {
        if (categoryOffer.discountType === "PERCENTAGE") {
          finalPrice = basePrice - (basePrice * categoryOffer.discountValue) / 100;
        } else {
          finalPrice = basePrice - categoryOffer.discountValue;
        }
        activeOffer = {
          type: "category",
          percentage:
            categoryOffer.discountType === "PERCENTAGE"
              ? categoryOffer.discountValue
              : Math.round((categoryOffer.discountValue / basePrice) * 100),
          discountedPrice: finalPrice,
          originalPrice: basePrice,
        };
      }
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
        price: finalPrice,
        images: activeVariant.images,
        stock: activeVariant.stock
      },
      activeOffer,
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
