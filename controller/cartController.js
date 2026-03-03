const Cart = require('../models/cartSchema')

const Wishlist = require('../models/wishlistSchema')
const User = require('../models/userSchema')
const Product = require('../models/productSchema')
const Category = require('../models/categorySchema')
const Subcategory = require('../models/subcategorySchema')
const Variant = require('../models/varientSchema')
const AppError = require('../config/AppError')
const HTTP_STATUS = require('../middleware/statusCode')
const { calculateItemPrice } = require('../config/offerCalculator');
const notFound = require('../middleware/notFound')

const MAX_QTY_PER_ITEM = 3

const getCart = async (req, res, next) => {
  try {
    const userId = req.session.user;
    if (!userId) {
      throw new AppError('Please Login', HTTP_STATUS.BAD_REQUEST);
    }

    const cart = await Cart.findOne({ userId })
      .populate('items.productId')
      .populate('items.variantId')
      .populate('items.categoryId')
      .populate('items.subcategoryId');

    if (!cart || cart.items.length === 0) {
      return res.render('user/cart', { cart: null });
    }

    let totalItem = 0;
    let totalPrice = 0;
    let hasInvalidItem = false;

    const validatedItems = [];

    for (const item of cart.items) {
      const product = item.productId?.isListed ? item.productId : null;
      const category = item.categoryId?.isListed ? item.categoryId : null;
      const subcategory = item.subcategoryId?.isListed ? item.subcategoryId : null;
      const variant = item.variantId;

      let isAvailable = true;
      let message = null;

      if (!product || !category || !subcategory || !variant) {
        isAvailable = false;
        message = 'This product is no longer available';
      } else if (variant.stock === 0) {
        isAvailable = false;
        message = 'Out of Stock';
      } else if (item.quantity > variant.stock) {
        isAvailable = false;
        message = `Only ${variant.stock} left in stock`;
      }

      let finalPrice = variant.price;
      let appliedOffer = null;

      if (isAvailable) {
        const offerResult = await calculateItemPrice(product, variant, item.categoryId?._id);

        finalPrice = offerResult.finalPrice;
        appliedOffer = offerResult.appliedOffer;

        totalItem += item.quantity;
        totalPrice += item.quantity * finalPrice;
      } else {
        hasInvalidItem = true;
      }


      validatedItems.push({
        _id: item._id,
        quantity: item.quantity,
        product,
        variant,
        finalPrice,
        appliedOffer,
        isAvailable,
        message
      });
    }

    return res.render('user/cart', {
      cart: {
        totalItem,
        totalPrice,
        items: validatedItems
      },
      hasInvalidItem
    });
  } catch (err) {
    next(new AppError(err.message, HTTP_STATUS.INTERNAL_SERVER_ERROR))
  }
}

const addToCart = async (req, res, next) => {

  try {
    const userId = req.session.user
    const { productId,variantId } = req.body

    if (!userId) {
      throw new AppError('Please Login', HTTP_STATUS.BAD_REQUEST)
    }

    if (!productId) {
      throw new AppError('Product not Found', HTTP_STATUS.BAD_REQUEST)
    }
    if (!variantId) {
      throw new AppError('Variant not Found', HTTP_STATUS.BAD_REQUEST)
    }

    const product = await Product.findOne({
      _id: productId,
      isListed: true
    });

    if (!product) {
      throw new AppError('variant Unavailable', HTTP_STATUS.BAD_REQUEST)
    }

    const category = await Category.findOne({
      _id: product.category_Id,
      isListed: true
    });

    if (!category) {
      throw new AppError('Category Unavailable', HTTP_STATUS.BAD_REQUEST)
    }

    const subcategory = await Subcategory.findOne({
      _id: product.subcategory_Id,
      isListed: true
    });

    if (!subcategory) {
      throw new AppError('Subcategory Unavailable', HTTP_STATUS.BAD_REQUEST)
    }

    const variant = await Variant.findOne({
      _id: variantId,
      product_id: productId,
      stock: { $gt: 0 }
    })

    if (!variant) {
      throw new AppError('Product is Out of Stock', HTTP_STATUS.BAD_REQUEST)
    }


    let cart = await Cart.findOne({ userId });

    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }

    // Check if item already exists in cart
    const existingItem = cart.items.find(item =>
      item.productId.toString() === productId.toString() &&
      item.variantId.toString() === variant._id.toString()
    );

    if (existingItem) {
      if (existingItem.quantity >= MAX_QTY_PER_ITEM) {
        throw new AppError(`Maximum ${MAX_QTY_PER_ITEM} items allowed per product`, HTTP_STATUS.BAD_REQUEST)
      }

      if (existingItem.quantity + 1 > variant.stock) {
        throw new AppError('Not enough stock available', HTTP_STATUS.BAD_REQUEST)
      }

      existingItem.quantity += 1;
    } else {
      cart.items.push({
        productId: product._id,
        categoryId: product.category_Id,
        subcategoryId: product.subcategory_Id,
        variantId: variant._id,
        quantity: 1
      })
    }

    //  Recalculate totals
    let totalItem = 0;
    let totalPrice = 0;

    for (const item of cart.items) {
      const v = await Variant.findById(item.variantId);
      if (!v) continue;

      totalItem += item.quantity;
      totalPrice += item.quantity * v.price;
    }

    cart.totalItem = totalItem;
    cart.totalPrice = totalPrice;

    await cart.save();

    // Remove from wishlist if exists
    await Wishlist?.updateOne(
      { userId },
      { $pull: { items: { productId :productId,variantId:variantId} } }
    );

    return res.status(HTTP_STATUS.CREATED).json({
      message: 'Product added to cart successfully',
      cartCount: cart.totalItem
      
    });

  } catch (err) {
    next(new AppError(err.message, HTTP_STATUS.INTERNAL_SERVER_ERROR))
  }
}

const updateCartQuantity = async (req, res, next) => {
  try {
    const userId = req.session.user;
    const { cartItemId, action } = req.body;

    if (!userId) {
      throw new AppError('Please login', HTTP_STATUS.UNAUTHORIZED);
    }

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      throw new AppError('Cart not found', HTTP_STATUS.NOT_FOUND);
    }

    const item = cart.items.id(cartItemId);
    if (!item) {
      throw new AppError('Cart item not found', HTTP_STATUS.NOT_FOUND);
    }

    const variant = await Variant.findById(item.variantId);
    if (!variant) {
      throw new AppError('Variant not found', HTTP_STATUS.BAD_REQUEST);
    }

    if (action === 'dec') {
      if (item.quantity > 1) {
        item.quantity -= 1;
      }
    }

    if (action === 'inc') {
      if (item.quantity >= variant.stock) {
        throw new AppError(`Only ${variant.stock} left in stock`, HTTP_STATUS.BAD_REQUEST);
      }
      if (item.quantity >= MAX_QTY_PER_ITEM) {
        throw new AppError(`Maximum ${MAX_QTY_PER_ITEM} items allowed per product`, HTTP_STATUS.BAD_REQUEST)
      }
      item.quantity += 1;
    }
    const product = await Product.findById(item.productId);
    if (!product || !product.isListed) {
      throw new AppError('Product unavailable', HTTP_STATUS.BAD_REQUEST);
    }

    const offerResult = await calculateItemPrice(product,variant,item.categoryId);
    const finalPrice = offerResult.finalPrice;
    const itemTotal = item.quantity * finalPrice;

    let totalItem = 0;
    let totalPrice = 0;

    for (const i of cart.items) {
      const v = await Variant.findById(i.variantId);
      if (!v) continue;

      const p = await Product.findById(i.productId);
      if (!p || !p.isListed) 
      continue;

      const priceResult = await calculateItemPrice( p,v,i.categoryId);
      totalItem += i.quantity;
      totalPrice += i.quantity * priceResult.finalPrice;
    }

    await cart.save();

    return res.status(HTTP_STATUS.CREATED).json({
      success: true,
      quantity: item.quantity,
     itemTotal,
     totalItem,
     totalPrice
    });
  } catch (err) {
    next(new AppError(err.message, HTTP_STATUS.INTERNAL_SERVER_ERROR))
  }
}
const removeFromCart = async (req, res, next) => {
  try {
    const userId = req.session.user;
    const { cartItemId } = req.body;

    if (!userId) {
      throw new AppError('Please login', HTTP_STATUS.UNAUTHORIZED);
    }

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      throw new AppError('Cart not found', HTTP_STATUS.NOT_FOUND);
    }

    cart.items = cart.items.filter(
      item => item._id.toString() !== cartItemId
    );
    cart.totalItem = cart.items.reduce((sum, item) => sum + item.quantity, 0);
    cart.totalPrice = 0;
    for (const item of cart.items) {
      const v = await Variant.findById(item.variantId);
      if (!v) continue;
      cart.totalPrice += item.quantity * v.price;
    }

    await cart.save();

    return res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: 'cart item removed',
      redirect: 'user/cart'
    })
  } catch (err) {
    next(new AppError(err.message, HTTP_STATUS.INTERNAL_SERVER_ERROR))
  }
}
const proceedToCheckout = async (req, res, next) => {
  try {
    const userId = req.session.user;
    if (!userId) {
      throw new AppError('Please login', HTTP_STATUS.UNAUTHORIZED);
    }

    const cart = await Cart.findOne({ userId });
    if (!cart || cart.items.length === 0) {
      throw new AppError('Cart is empty', HTTP_STATUS.BAD_REQUEST);
    }

    for (const item of cart.items) {
      const variant = await Variant.findById(item.variantId);

      if (!variant || variant.stock === 0 || item.quantity > variant.stock) {
        throw new AppError(
          'Remove unavailable items before proceeding',
          HTTP_STATUS.BAD_REQUEST
        );
      }
    }

    return res.status(HTTP_STATUS.CREATED).json({
      success: true,
      redirect: '/user/checkout'
    });

  } catch (err) {
    next(new AppError(err.message, HTTP_STATUS.INTERNAL_SERVER_ERROR))
  }
};







module.exports = {
  getCart,
  addToCart,
  updateCartQuantity,
  removeFromCart,
  proceedToCheckout

}