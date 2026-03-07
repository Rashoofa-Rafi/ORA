const Wishlist = require('../models/wishlistSchema')
const Cart = require('../models/cartSchema')
const Variant = require('../models/varientSchema')
const Product = require('../models/productSchema')
const User = require('../models/userSchema')
const Offer=require('../models/offerSchema')
const { calculateItemPrice } = require('../config/offerCalculator')
const AppError = require('../config/AppError')
const HTTP_STATUS = require('../middleware/statusCode')
const notFound = require('../middleware/notFound')

const getWishlist = async (req, res, next) => {
    try {
      const userId = req.session.user;
  
      if (!userId) {
        throw new AppError("Please login", HTTP_STATUS.UNAUTHORIZED);
      }
  
      
      const wishlist = await Wishlist.findOne({ userId })
      .populate({
        path: "items.productId",
        populate: { path: "category_Id", select: "_id name" }
      })
      .populate({
        path: "items.variantId",
        select: "price stock color images"
      })
      
  if (!wishlist || wishlist.items.length === 0) {
    return res.render("user/wishlist", { wishlist: null });
  }

  const updatedItems = await Promise.all(
    wishlist.items.map(async (item) => {
      const product = item.productId;
      const variant = item.variantId;
  
      if (!product || !variant) return item;
  
      const priceData = await calculateItemPrice(
        product,
        variant,
        product.category_Id._id
      );
  
      return {
        ...item.toObject(),
        finalPrice: priceData.finalPrice,
        originalPrice: priceData.discountAmount ? priceData.basePrice : null,
        offerPercentage: priceData.discountAmount
          ? Math.round((priceData.discountAmount / priceData.basePrice) * 100)
          : null
      };
    })
  );

  const wishlistObj = wishlist.toObject();
wishlistObj.items = updatedItems;
  
      res.render("user/wishlist", { wishlist: wishlistObj });
  
    } catch (err) {
      next(err);
    }
  };

const addToWishlist = async (req, res, next) => {
    try {
        const userId = req.session.user;
        const { productId, variantId } = req.body;
        console.log('REQ>BODY',req.body)
        if (!variantId) {
            throw new AppError(HTTP_STATUS.BAD_REQUEST, 'variantId is required')
        }

        let wishlist = await Wishlist.findOne({ userId });

        if (!wishlist) {
            wishlist = await Wishlist.create({
                userId,
                items: [{ productId, variantId }]
            });
        } else {
            const exists = wishlist.items.some(
                item =>
                    item.productId.equals(productId) &&
                    item.variantId.equals(variantId)
            );

            if (exists) {
                return res.status(HTTP_STATUS.BAD_REQUEST).json({
                    success: false,
                    message: "Already in wishlist"
                });
            }

            wishlist.items.push({ productId, variantId });
            await wishlist.save();
        }

        res.status(HTTP_STATUS.OK).json({
            success: true,
            wishlistCount: wishlist.items.length,
            message: 'successfully added to Wishlist'
        });
    } catch (err) {
        next(err)
    }

}

const removeFromWishlist = async (req, res, next) => {
    const userId = req.session.user
    const { productId, variantId } = req.body

    await Wishlist.updateOne({ userId },
        {
            $pull: {
                items: { productId, variantId }
            }
        }
    );

    res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Item removed'
    });
};



module.exports = {
    getWishlist,
    addToWishlist,
    removeFromWishlist,
    
}