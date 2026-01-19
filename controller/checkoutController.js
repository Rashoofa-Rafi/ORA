const Cart = require('../models/cartSchema')
const Address = require('../models/addressSchema')
const Variant = require('../models/varientSchema')
const Product = require('../models/productSchema')
const Order = require('../models/orderSchema')
const Coupon = require('../models/couponSchema')
const User=require('../models/userSchema')
const AppError = require('../config/AppError')
const HTTP_STATUS = require('../middleware/statusCode')
const { calculateItemPrice } = require('../config/offerCalculator')

    ;

const notFound = require('../middleware/notFound')

const applyCoupon = async (req, res, next) => {
    try {
        const userId = req.session.user
        const { code } = req.body

        const cart = await Cart.findOne({ userId })
            .populate('items.variantId')

        if (!cart || cart.items.length === 0) {
            throw new AppError('Cart is empty', HTTP_STATUS.BAD_REQUEST)
        }

        // prevent multiple coupons
        if (req.session.coupon) {
            throw new AppError('Coupon already applied', HTTP_STATUS.BAD_REQUEST)
        }

        const coupon = await Coupon.findOne({
            code: code.toUpperCase(),
            isActive: true
        })

        if (!coupon) {
            throw new AppError('Coupon invalid', HTTP_STATUS.BAD_REQUEST)
        }

        if (coupon.endDate < Date.now()) {
            throw new AppError('Coupon expired', HTTP_STATUS.BAD_REQUEST)
        }

        if (coupon.usedCount >= coupon.usageLimit) {
            throw new AppError('Coupons usage limit reached', HTTP_STATUS.BAD_REQUEST)

        }
        const totalPrice = cart.items.reduce(
            (sum, i) => sum + i.quantity * i.variantId.price,
            0
        )
        if (totalPrice < coupon.minOrderPrice) {
            throw new AppError(`Minimum order ₹${coupon.minOrderPrice}`, HTTP_STATUS.BAD_REQUEST)
        }


        let discountAmount = coupon.discountType === 'PERCENTAGE'
            ? Math.floor((totalPrice * coupon.discountValue) / 100)
            : coupon.discountValue

        discountAmount = Math.min(discountAmount, totalPrice)

        req.session.coupon = {
            couponId: coupon._id,
            code: coupon.code,
            discountAmount
        }

        return res.status(HTTP_STATUS.OK).json({
            success: true,
            message: 'Coupon applied successfully'
        })

    } catch (err) {
        next(err)
    }
}
const removeCoupon = async (req, res, next) => {
    try {
        req.session.coupon = null
        res.status(HTTP_STATUS.OK).json({
            success: true,
            message: 'Coupon removed'
        })

    } catch (err) {
        next(err)
    }

}

const getCheckout = async (req, res, next) => {
    try {
        const userId = req.session.user;
        if (!userId) {
            throw new AppError('Please login', HTTP_STATUS.UNAUTHORIZED);
        }

        const cart = await Cart.findOne({ userId })
            .populate('items.productId')
            .populate('items.variantId');

        if (!cart || cart.items.length === 0) {
            return res.redirect('/user/cart');
        }

        const cartItems = [];
        let totalItems = 0;
        let originalTotal = 0;
        let discountedTotal = 0
        let offerDiscount = 0;

        for (const item of cart.items) {
            const product = item.productId;
            const variant = item.variantId;

            if (!product || !variant || !product.isListed || variant.stock === 0 || item.quantity > variant.stock) {
                return res.redirect('/user/cart');
            }

            const offerResult = await calculateItemPrice(product, variant, item.categoryId?._id);
            const basePrice = variant.price;
            const finalPrice = offerResult.finalPrice;
            const discountPerItem = basePrice - finalPrice;

            totalItems += item.quantity;
            originalTotal += item.quantity * basePrice
            discountedTotal += item.quantity * finalPrice;
            offerDiscount += item.quantity * discountPerItem;

            cartItems.push({
                ...item.toObject(),
                basePrice,
                finalPrice,
                discountPerItem,
                appliedOffer: offerResult.appliedOffer
            });
        }

        const addresses = await Address.find({ user_Id: userId });

        const deliveryCharge = originalTotal > 1000 ? 0 : 50;
        const platformFee = 10;
        const couponDiscount = req.session.coupon ? req.session.coupon.discountAmount : 0
        const finalAmount =
            discountedTotal + deliveryCharge + platformFee - couponDiscount;
        const appliedCoupon = req.session.coupon || null;

        return res.render('user/checkout', {
            cartItems,
            addresses,
            appliedCoupon,
            summary: {
                totalItems,
                originalTotal,
                discountedTotal,
                deliveryCharge,
                platformFee,
                offerDiscount,
                couponDiscount,
                finalAmount: discountedTotal + deliveryCharge + platformFee - couponDiscount,

            }
        });
    } catch (err) {
        next(new AppError(err.message, HTTP_STATUS.INTERNAL_SERVER_ERROR))
    }
}
const checkoutContinue = async (req, res, next) => {
    try {
        const userId = req.session.user;
        const { addressId } = req.body;

        if (!addressId) {
            throw new AppError('Select an address', HTTP_STATUS.BAD_REQUEST);
        }

        const cart = await Cart.findOne({ userId })
            .populate('items.productId')
            .populate('items.variantId');

        if (!cart || cart.items.length === 0) {
            throw new AppError('Cart is empty', HTTP_STATUS.BAD_REQUEST);
        }
        // validate cart again (CRITICAL)
        for (const item of cart.items) {
            const variant = await Variant.findById(item.variantId);

            if (!variant || variant.stock === 0 || item.quantity > variant.stock) {
                throw new AppError('Remove unavailable items before proceeding', HTTP_STATUS.BAD_REQUEST);
            }
        }
        const cartItems = [];
        let totalItems = 0;
        let originalTotal = 0;
        let discountedTotal = 0
        let offerDiscount = 0;

        for (const item of cart.items) {
            const product = item.productId;
            const variant = item.variantId;

            const offerResult = await calculateItemPrice(product, variant,item.categoryId?._id);
const basePrice = variant.price;
            const finalPrice = offerResult.finalPrice;
            const discountPerItem = variant.price - finalPrice;

            originalTotal += item.quantity * basePrice
            totalItems += item.quantity;
            discountedTotal += item.quantity * finalPrice;
            offerDiscount += item.quantity * discountPerItem;
        }

        const deliveryCharge = originalTotal > 1000 ? 0 : 50;
        const platformFee = 10;


        req.session.checkout = {
            addressId,
            totalItems,
            originalTotal,
            discountedTotal,
            deliveryCharge,
            platformFee,
            offerDiscount,
            couponDiscount: req.session.coupon ? req.session.coupon.discountAmount : 0,
            finalAmount: discountedTotal + deliveryCharge + platformFee
                - (req.session.coupon ? req.session.coupon.discountAmount : 0)

        };

        res.redirect('/user/payment');
    } catch (err) {
        next(new AppError(err.message, HTTP_STATUS.INTERNAL_SERVER_ERROR))
    }
};
const getPaymentPage = async (req, res, next) => {
    try {
        const userId = req.session.user;
        const checkout = req.session.checkout;

        if (!checkout) {
            throw new AppError('Invalid checkout session', HTTP_STATUS.BAD_REQUEST);
        }
        const address = await Address.findById(checkout.addressId);
        const cart = await Cart.findOne({ userId })
            .populate('items.productId')
            .populate('items.variantId');
        const {
            totalItems,
            discountedTotal,
            originalTotal,
            deliveryCharge,
            platformFee,
            offerDiscount,
            couponDiscount,
            finalAmount
        } = checkout;
        const cartItems = [];

        for (const item of cart.items) {
            const offerResult = await calculateItemPrice(item.productId, item.variantId,item.categoryId?._id);

            cartItems.push({
                ...item.toObject(),
                finalPrice: offerResult.finalPrice,
                appliedOffer: offerResult.appliedOffer
            });
        }

        const appliedCoupon = req.session.coupon || null;
        res.render('user/payment', {
            address,
            cartItems,
            appliedCoupon,
            summary: {
                totalItems,
                originalTotal,
                discountedTotal,
                deliveryCharge,
                platformFee,
                offerDiscount,
                couponDiscount,
                finalAmount
            }
        })
    } catch (err) {
        next(new AppError(err.message, HTTP_STATUS.INTERNAL_SERVER_ERROR))
    }
};
const placeOrder = async (req, res, next) => {
    try {
        const userId = req.session.user
        const { paymentMethod } = req.body
        const checkout = req.session.checkout
        const appliedCoupon = req.session.coupon || null

        if (!checkout) {
            throw new AppError('Session expired', HTTP_STATUS.BAD_REQUEST);
        }
        if (!paymentMethod) {
            throw new AppError('select a payment Method', HTTP_STATUS.BAD_REQUEST)
        }
        const address = await Address.findById(checkout.addressId);

        if (!address) {
            throw new AppError("Address not found", HTTP_STATUS.BAD_REQUEST);
        }

        const cart = await Cart.findOne({ userId })
            .populate('items.productId')
            .populate('items.variantId');

        // FINAL validation 
        for (const item of cart.items) {
            const variant = item.variantId;

            if (!variant || variant.stock === 0 || item.quantity > variant.stock) {
                throw new AppError('Remove unavailable items before proceeding', HTTP_STATUS.BAD_REQUEST);
            }
        }
        let originalTotal = 0
        let recalculatedTotal = 0;
        let recalculatedOfferDiscount = 0;
        const orderItems = [];

        for (const item of cart.items) {
            const offerResult = await calculateItemPrice(item.productId, item.variantId, item.categoryId?._id);

            const basePrice = item.variantId.price;
            const finalPrice = offerResult.finalPrice;

            originalTotal += item.quantity * basePrice;
            recalculatedTotal += item.quantity * finalPrice;
            recalculatedOfferDiscount += item.quantity * (basePrice - finalPrice);

            orderItems.push({
                productId: item.productId._id,
                variantId: item.variantId._id,
                productName: item.productId.productname,
                quantity: item.quantity,
                price: finalPrice,
                appliedOffer: offerResult.appliedOffer,
                image: item.variantId.images[0],
                itemStatus: "pending"
            });
        }

        const totalItems = cart.items.reduce((sum, item) => sum + item.quantity, 0)
        const orderId = `ORD${Date.now()}`
        const couponDiscount = appliedCoupon ? appliedCoupon.discountAmount : 0;
        const finalAmount = recalculatedTotal + checkout.deliveryCharge + checkout.platformFee - couponDiscount;
        if (couponDiscount > recalculatedTotal) {
            throw new AppError('Invalid coupon discount', HTTP_STATUS.BAD_REQUEST);
        }

        const order = await Order.create({
            orderId,
            userId,
            paymentMethod,
            totalItems,
            totalPrice: originalTotal,
            deliveryCharge: checkout.deliveryCharge,
            platformFee: checkout.platformFee,
            offerDiscount: recalculatedOfferDiscount,
            finalAmount,
            coupon: appliedCoupon ? {
                couponId: appliedCoupon.couponId,
                code: appliedCoupon.code,
                discountAmount: appliedCoupon.discountAmount
            } : null,
            orderStatus: "pending",
            orderItems,
            address: {
                addressType: address.addressType,
                addressLine: address.addressLine,
                name: address.name,
                city: address.city,
                locality: address.locality,
                landmark: address.landmark,
                state: address.state,
                pincode: address.pincode,
                phone: address.phone,
                altPhone: address.altPhone
            }
        });

        const user = await User.findById(userId);
if (user.referredBy && !user.referralRewardApplied){
    // Check if this is FIRST successful order
    const previousOrdersCount = await Order.countDocuments({
        userId,
        orderStatus: { $ne: 'cancelled' }
    });

    if (previousOrdersCount === 1) { 
        // 1 because current order is already created

        const referrer = await User.findById(user.referredBy);

        const REFERRER_REWARD = 100;
        const REFEREE_REWARD = 50;

        //  for referrer
        referrer.wallet.balance += REFERRER_REWARD;
        referrer.wallet.transactions.push({
            type: 'CREDIT',
            amount: REFERRER_REWARD,
            reason: `Referral reward for order ${order.orderId}`
        });

        // for referee (current user)
        user.wallet.balance += REFEREE_REWARD;
        user.wallet.transactions.push({
            type: 'CREDIT',
            amount: REFEREE_REWARD,
            reason: 'Referral signup reward'
        });

        user.referralRewardApplied = true;

        await referrer.save();
        await user.save();
    }
}

        //increment Usedcount
        if (appliedCoupon) {
            await Coupon.findByIdAndUpdate(
                appliedCoupon.couponId,
                { $inc: { usedCount: 1 } }
            );
        }

        // Reduce stock
        for (const item of cart.items) {
            await Variant.findByIdAndUpdate(
                item.variantId._id,
                { $inc: { stock: -item.quantity } }
            );
            await Product.findByIdAndUpdate(
                item.productId._id,
                { $inc: { totalStock: -item.quantity } }
            );
        }

        // Clear cart + checkout session
        await Cart.deleteOne({ userId });
        delete req.session.checkout;
        req.session.coupon = null

        res.status(HTTP_STATUS.CREATED).json({
            success: true,
            orderId: order.orderId
        })
    } catch (err) {
        next(new AppError(err.message, HTTP_STATUS.INTERNAL_SERVER_ERROR))
    }
}
const getOrderSuccess = async (req, res, next) => {
    try {
        const userId = req.session.user;
        const { orderId } = req.params;

        if (!userId) {
            throw new AppError('please login', HTTP_STATUS.UNAUTHORIZED)
        }

        if (!orderId) {
            throw new AppError('Invalid order', HTTP_STATUS.BAD_REQUEST);
        }

        const order = await Order.findOne({
            orderId,
            userId
        });

        if (!order) {
            throw new AppError('Order not found', HTTP_STATUS.NOT_FOUND);
        }

        return res.render('user/order-success', {
            order: {
                orderId: order.orderId,
                paymentTime: order.createdAt.toLocaleString(),
                paymentMethod: order.paymentMethod,
                userName: order.address.name,
                totalAmount: order.finalAmount
            }
        });


    } catch (err) {
        next(err)
    }
}


module.exports = {
    applyCoupon,
    removeCoupon,
    getCheckout,
    checkoutContinue,
    getPaymentPage,
    placeOrder,
    getOrderSuccess


}