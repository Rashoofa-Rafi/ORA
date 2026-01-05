const Product = require('../models/productSchema')
const Variant = require('../models/varientSchema')
const Category = require('../models/categorySchema')
const Subcategory = require('../models/subcategorySchema')
const cloudinary = require("../config/cloudinary");
const fs = require("fs");
const AppError = require('../config/AppError');
const HTTP_STATUS = require('../middleware/statusCode');

const productInfo = async (req, res, next) => {
  try {
    let search = req.query.search || ''
    let page = parseInt(req.query.page) || 1
    let limit = 6

    let filter = {}
    if (search) {
      filter.productname = { $regex: '.*' + search + '.*', $options: 'i' }
    }

    const products = await Product.find(filter)
      .populate("category_Id")
      .populate("subcategory_Id")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)

    const count = await Product.countDocuments(filter)
    const totalPages = Math.ceil(count / limit)

    const categories = await Category.find({ isListed: true })
    const subcategories = await Subcategory.find({ isListed: true })

    res.render('admin/product', {
      products, search, totalPages, page, categories, subcategories, currentPath: req.path
    })


  } catch (err) {
    next(new AppError(err.message, HTTP_STATUS.INTERNAL_SERVER_ERROR))
  }
}
const getaddProduct = async (req, res, next) => {
  try {
    const categories = await Category.find({ isListed: true })
    const subcategories = await Subcategory.find({ isListed: true })
    const brands = ['CASIO', 'TITAN', 'FOSSIL', 'FASTRACK', 'ROLEX', 'NAVIFORCE', 'DANIEL KLEIN', 'OTHERS']
    const materials = ['Metal', 'Rubber', 'Leather']
    const dials = ['Analogue', 'Digital', "Smart"]

    res.render('admin/add-product', {
      categories,
      subcategories,
      brands,
      materials,
      dials

    })
  } catch (err) {
    next(new AppError(err.message, HTTP_STATUS.INTERNAL_SERVER_ERROR))
  }
}
const addProduct = async (req, res, next) => {
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
      throw new AppError('All product fields are required', HTTP_STATUS.BAD_REQUEST)

    }

    // parse variants JSON
    let variantArray = [];
    try {
      variantArray = JSON.parse(variants || "[]");
    } catch (err) {
      throw new AppError("Invalid variants payload", HTTP_STATUS.BAD_REQUEST)

    }

    if (!Array.isArray(variantArray) || variantArray.length === 0) {
      throw new AppError("At least one variant required", HTTP_STATUS.BAD_REQUEST)

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
        throw new AppError(`Invalid price for variant `, HTTP_STATUS.BAD_REQUEST)

      }
      if (v.stock == null || isNaN(v.stock) || Number(v.stock) < 0) {
        throw new AppError(`Invalid stock for variant `, HTTP_STATUS.BAD_REQUEST)

      }
      if (!v.color) {
        throw new AppError(`please select a color for variant `, HTTP_STATUS.BAD_REQUEST)

      }

      const fieldName = `variantImages_${i}`;
      const uploadedFiles = filesByField[fieldName] || [];

      if (uploadedFiles.length < 3) {
        return res.status(400).json({ success: false, message: `Variant requires at least 3 images` });
      }

      // Cloudinary returns file.path = secure_url
      const imageURLs = uploadedFiles.map(img => img.path);

      // generate SKU
      const sku = `SKU-${product._id.toString().slice(-6)}-${i + 1}-${Date.now().toString().slice(-4)}`;

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
    return res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: "Product added successfully",
      redirect1: "/admin/products"
    });

  } catch (err) {
    next(new AppError(err.message, HTTP_STATUS.INTERNAL_SERVER_ERROR))
  }
};

const geteditProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    const variants = await Variant.find({ product_id: productId })
    const product = await Product.findById(productId)
      .populate("variants")
      .populate("category_Id")
      .populate("subcategory_Id")

    if (!product) {
      throw new AppError(" Product not found", HTTP_STATUS.BAD_REQUEST)

    }

    // Fetch dropdown lists
    const categories = await Category.find()
    const subcategories = await Subcategory.find()
    const brands = ['CASIO', 'TITAN', 'FOSSIL', 'FASTRACK', 'ROLEX', 'NAVIFORCE', 'OTHERS']
    const materials = ['Metal', 'Rubber', 'Leather']
    const dials = ['Analogue', 'Digital']

    return res.render("admin/edit-product", {
      product,
      categories,
      subcategories,
      brands,
      materials,
      dials,
      variants
    })
  } catch (err) {
    next(new AppError(err.message, HTTP_STATUS.INTERNAL_SERVER_ERROR))
  }
}


const editProduct = async (req, res, next) => {
  try {
    const productId = req.params.id;

    const {
      productname,
      description,
      category_Id,
      subcategory_Id,
      brand,
      material,
      dialType,
      isListed
    } = req.body;

    const product = await Product.findById(productId);

    product.productname = productname;
    product.description = description;
    product.category_Id = category_Id;
    product.subcategory_Id = subcategory_Id;
    product.brand = brand;
    product.material = material;
    product.dialType = dialType;

    if (typeof isListed !== "undefined") {
      product.isListed = isListed === "true";
    }
    
    const variants = JSON.parse(req.body.variants || "[]");

    for (const v of variants) {
      const variant = await Variant.findById(v._id);
      if (!variant) continue;

      variant.color = v.color;
      variant.price = v.price;
      variant.stock = v.stock;

      let removeImages = Array.isArray(v.removeImages) ? v.removeImages : [];
      variant.images = variant.images.filter(img => !removeImages.includes(img));

      const newFiles = (req.files || []).filter(
        f => f.fieldname === `variantImages_${v._id}[]`
      );

      for (const file of newFiles) {
        variant.images.push(file.path);
      }

      await variant.save();
    }
    const totalStock = await Variant.aggregate([
      { $match: { product_id: product._id } },
      { $group: { _id: null, total: { $sum: "$stock" } } }
    ]);

    product.totalStock = totalStock[0]?.total || 0;
await product.save()

    return res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: "Product successfully updated",
      redirect: "/admin/products"
    });

  } catch (err) {
    next(new AppError(err.message, HTTP_STATUS.INTERNAL_SERVER_ERROR))
  }
};

const deleteProduct = async (req, res, next) => {
  try {
    const productId = req.params.id
    const updated = await Product.findByIdAndUpdate(productId, { isListed: false })

    if (!updated) {
      throw new AppError("Failed to delete product", HTTP_STATUS.BAD_REQUEST)

    }

    return res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (err) {
    next(new AppError(err.message, HTTP_STATUS.INTERNAL_SERVER_ERROR))
  }
}


module.exports = {
  productInfo,
  getaddProduct,
  addProduct,
  geteditProduct,
  editProduct,
  deleteProduct
}