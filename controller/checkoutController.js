const Cart = require('../models/cartSchema')
const Address = require('../models/addressSchema')
const Variant = require('../models/varientSchema')
const Product = require('../models/productSchema')
const Order = require('../models/orderSchema')
const Coupon = require('../models/couponSchema')
const User = require('../models/userSchema')
const Wallet = require('../models/walletSchema');
const WalletTransaction = require('../models/walletTransactionSchema')
const AppError = require('../config/AppError')
const HTTP_STATUS = require('../middleware/statusCode')
const { calculateItemPrice } = require('../config/offerCalculator')
const { finalizeOrder } = require('../helpers/finalizeOrder')
const razorpay = require('../config/razorpay');
const crypto = require('crypto');

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

            const offerResult = await calculateItemPrice(product, variant, item.categoryId?._id);
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
            const offerResult = await calculateItemPrice(item.productId, item.variantId, item.categoryId?._id);

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
        if (paymentMethod === 'RAZORPAY') {
            const existingOrder = await Order.findOne({
                userId,
                paymentMethod: "RAZORPAY",
                isFinalized: false,
                "payment.status": { $in: ["PENDING"] }
            });

            if (existingOrder) {
                return res.status(HTTP_STATUS.BAD_REQUEST).json({
                    success: false,
                    message: "You already have a pending  payment. Retry from Orders page."
                });
            }
        }

        const address = await Address.findById(checkout.addressId);

        if (!address) {
            throw new AppError("Address not found", HTTP_STATUS.BAD_REQUEST);
        }


        const cart = await Cart.findOne({ userId })
            .populate('items.productId')
            .populate('items.variantId');

        if (!cart || cart.items.length === 0) {
            throw new AppError("Cart is empty", HTTP_STATUS.BAD_REQUEST);
        }

        // FINAL validation 
        let recalculatedTotal = 0;

        for (const item of cart.items) {
            const offerResult = await calculateItemPrice(item.productId, item.variantId, item.categoryId?._id);
            recalculatedTotal += item.quantity * offerResult.finalPrice;
        }

        let distributedCoupon = 0;
        let originalTotal = 0
        let recalculatedOfferDiscount = 0;
        const orderItems = [];

        for (let i = 0; i < cart.items.length; i++) {
            const item = cart.items[i];
            const offerResult = await calculateItemPrice(item.productId, item.variantId, item.categoryId?._id);
            const basePrice = item.variantId.price;
            const finalPrice = offerResult.finalPrice;
            const itemTotal = item.quantity * finalPrice;

            let itemCouponShare = 0;
            if (appliedCoupon) {
                if (i === cart.items.length - 1) {
                    itemCouponShare = appliedCoupon.discountAmount - distributedCoupon;
                } else {
                    itemCouponShare = Math.floor((itemTotal / (recalculatedTotal || 1)) * appliedCoupon.discountAmount);
                    distributedCoupon += itemCouponShare;
                }
            }

            orderItems.push({
                productId: item.productId._id,
                variantId: item.variantId._id,
                productName: item.productId.productname,
                quantity: item.quantity,
                price: finalPrice,
                couponShare: itemCouponShare,
                finalItemAmount: itemTotal - itemCouponShare,
                appliedOffer: offerResult.appliedOffer,
                discount: item.quantity * (item.variantId.price - finalPrice),
                image: item.variantId.images[0],
                itemStatus: "pending"
            });

            originalTotal += item.quantity * basePrice;
            recalculatedOfferDiscount += item.quantity * (basePrice - finalPrice);
        }

        const totalItems = cart.items.reduce((sum, item) => sum + item.quantity, 0)
        const couponDiscount = appliedCoupon ? appliedCoupon.discountAmount : 0;
        const finalAmount = orderItems.reduce((sum, i) => sum + i.finalItemAmount, 0)
            + checkout.deliveryCharge
            + checkout.platformFee;

        if (couponDiscount > recalculatedTotal) {
            throw new AppError('Invalid coupon discount', HTTP_STATUS.BAD_REQUEST);
        }
        if (paymentMethod === "WALLET") {
            const wallet = await Wallet.findOne({ userId })
            if (!wallet || wallet.balance < finalAmount) {
                throw new AppError("Insufficient wallet balance", HTTP_STATUS.BAD_REQUEST);
            }
        }
        if (!finalAmount || isNaN(finalAmount) || finalAmount <= 0) {
            throw new AppError(`Invalid payment amount: ${finalAmount}`, HTTP_STATUS.BAD_REQUEST);
        }
        if (paymentMethod === "COD" && finalAmount > 1000) {
            throw new AppError("Cash on Delivery is not available for orders above ₹1000",HTTP_STATUS.BAD_REQUEST)
        }
        let razorpayOrder

        if (paymentMethod === "RAZORPAY") {
             razorpayOrder = await razorpay.orders.create({
                amount: Math.round(finalAmount * 100),
                currency: "INR",
                receipt: `TEMP${Date.now()}`
            });
            if(!razorpayOrder){
                throw new AppError('payment gateway error',HTTP_STATUS.BAD_REQUEST)
            }
            
        }

        const orderId = `ORD${Date.now()}`

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
            coupons: appliedCoupon ? {
                couponId: appliedCoupon.couponId,
                code: appliedCoupon.code,
                discountAmount: appliedCoupon.discountAmount
            } : null,
            orderStatus: paymentMethod === "COD" ? "confirmed" : "pending",
            isFinalized: false,
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
            },
            payment: { status: 'PENDING' }
        });

        //  COD 
        if (paymentMethod === "COD") {
            await finalizeOrder(order._id);

            delete req.session.checkout;
            req.session.coupon = null

            return res.status(HTTP_STATUS.CREATED).json({
                success: true,
                message: 'order placed successfully',
                orderId: order.orderId
            });
        }


        // Wallet Payment
        if (paymentMethod === "WALLET") {
            const wallet = await Wallet.findOne({ userId })
            wallet.balance -= finalAmount;
            await wallet.save();

            await WalletTransaction.create({
                userId,
                type: "DEBIT",
                amount: finalAmount,
                reason: `Payment for order ${order.orderId}`,
                orderId: order.orderId,
                balanceAfter: wallet.balance
            });
            order.payment.status = "PAID";
            order.orderStatus = "confirmed";
            order.orderItems.forEach(item => {
                item.itemStatus = 'confirmed';
            });
            await order.save()

            await finalizeOrder(order._id);
            delete req.session.checkout;
            req.session.coupon = null;

            return res.status(HTTP_STATUS.CREATED).json({
                success: true,
                message: "Order placed successfully",
                orderId: order.orderId
            });
        }
         if (paymentMethod === "RAZORPAY") {
            order.payment.razorpay = {
                orderId: razorpayOrder.id,
            };

            await order.save();
            return res.json({
                success: true,
                razorpayOrderId: razorpayOrder.id,
                message: 'order created,payment pending',
                orderId: order.orderId,
                amount: order.finalAmount
            });
        }





        throw new AppError("Invalid payment method", HTTP_STATUS.BAD_REQUEST)

    } catch (err) {
        next(err)
    }
}

const verifyRazorpayPayment = async (req, res, next) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !orderId) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: "Invalid payment data",
                retry: true
            });
        }

        const order = await Order.findOne({ orderId, userId: req.session.user });
        if (!order) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: "Order not found",
                retry: true
            });
        }

        // Idempotency: already finalized
        if (order.isFinalized) {
            return res.status(HTTP_STATUS.OK).json({
                success: true,
                message: "Order already confirmed",
                orderId: order.orderId
            });
        }
        if (!order.payment?.razorpay || order.payment.razorpay.orderId !== razorpay_order_id) {

            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: "Invalid payment reference",
                retry: false
            })
        }

        // Signature verification
        const hmac = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET);
        hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
        const generatedSignature = hmac.digest("hex");


        if (generatedSignature !== razorpay_signature) {

            order.payment.status = "FAILED";
            order.orderStatus = "pending"
            await order.save();

            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: "Payment failed",
                retry: true,
                orderId: order.orderId
            });
        }

        // Payment verified → finalize order
        order.orderStatus = "confirmed";
        order.payment.status = "PAID";
        order.orderItems.forEach(item => {
            item.itemStatus = 'confirmed';
        });

        order.payment.razorpay = {
            orderId: razorpay_order_id,
            paymentId: razorpay_payment_id,
            signature: razorpay_signature
        };
        await order.save();

        await finalizeOrder(order._id);

        // Clear session
        delete req.session.checkout;
        req.session.coupon = null;

        return res.status(200).json({
            success: true,
            message: "Order placed successfully",
            orderId: order.orderId
        });

    } catch (err) {
        next(err);
    }
};



const getOrderSuccess = async (req, res, next) => {
    try {
        const userId = req.session.user;
        const { orderId } = req.params;

        if (!orderId) {
            throw new AppError('Invalid order', HTTP_STATUS.BAD_REQUEST);
        }

        const order = await Order.findOne({ orderId, userId });

        if (!order) {
            throw new AppError('Order not found', HTTP_STATUS.NOT_FOUND);
        }
        if (order.paymentMethod === 'RAZORPAY' && order.orderStatus === 'pending') {
            throw new AppError('Payment not completed yet', HTTP_STATUS.BAD_REQUEST);
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
const createRetryRazorpayOrder = async (req, res, next) => {
    try {
        const { orderId } = req.params;
        const order = await Order.findOne({ orderId, userId: req.session.user });
        if (!order) throw new Error("Order not found");
        if (order.paymentMethod !== 'RAZORPAY') {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: 'Retry not allowed for this payment method'
            });
        }

        if (order.payment.status === 'PAID') {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: "Order already paid" });
        }
        if (order.payment.status !== 'FAILED') {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: 'Payment retry not allowed' });
        }

        const finalAmount = order.finalAmount;
        if (!finalAmount || finalAmount <= 0) {
            throw new Error("Invalid payment amount");
        }

        // Create Razorpay order

        const razorpayOrder = await razorpay.orders.create({
            amount: Math.round(finalAmount * 100),
            currency: "INR",
            receipt: order.orderId,
        });

        // Update order with new Razorpay order
        order.payment.status = 'PENDING';
        order.payment.razorpay = { orderId: razorpayOrder.id };
        await order.save();

        res.json({
            success: true,
            razorpayOrderId: razorpayOrder.id,
            amount: finalAmount,
            orderId: order.orderId
        });
    } catch (err) {
        next(err);
    }
};
const paymentFailed = async (req, res, next) => {
    try {

        const { orderId } = req.params;

        const userId = req.session.user;

        const order = await Order.findOne({ orderId, userId });
        if (!order) throw new AppError("Order not found", HTTP_STATUS.UNAUTHORIZED);

        // Only mark as failed if still pending
        if (order.payment.status === 'PENDING') {
            order.payment.status = 'FAILED';
            order.orderStatus = 'pending';
            await order.save();
        }
        delete req.session.checkout;
        req.session.coupon = null;
        res.json({ success: true, message: "Payment marked as failed" });
    } catch (err) {
        next(err);
    }
};



module.exports = {
    applyCoupon,
    removeCoupon,
    getCheckout,
    checkoutContinue,
    getPaymentPage,
    placeOrder,
    verifyRazorpayPayment,
    getOrderSuccess,
    createRetryRazorpayOrder,
    paymentFailed
}


