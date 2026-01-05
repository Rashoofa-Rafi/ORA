const Cart = require('../models/cartSchema')
const Address = require('../models/addressSchema')
const Variant = require('../models/varientSchema')
const Product=require('../models/productSchema')
const Order = require('../models/orderSchema')
const AppError = require('../config/AppError')
const HTTP_STATUS = require('../middleware/statusCode')
const notFound = require('../middleware/notFound')


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
        const cartItems = []
        let totalItems = 0
        let totalPrice = 0

        for (const item of cart.items) {
            const product = item.productId;
            const variant = item.variantId;
            if (!product || !variant || !product.isListed || variant.stock === 0 || item.quantity > variant.stock) {
                return res.redirect('/user/cart');
            }

            cartItems.push(item);
            totalItems += item.quantity;
            totalPrice += item.quantity * item.variantId.price;
        }
        const addresses = await Address.find({ user_Id: userId });

        const deliveryCharge = totalPrice > 1000 ? 0 : 50;
        const platformFee = 10;
        const discount = 0;

        const finalAmount =
            totalPrice + deliveryCharge + platformFee - discount;

        return res.render('user/checkout', {
            cartItems,
            addresses,
            summary: {
                totalItems,
                totalPrice,
                deliveryCharge,
                platformFee,
                discount,
                finalAmount
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


        req.session.checkout = {
            addressId,
            totalItems: cart.totalItem,
            totalPrice: cart.totalPrice,
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
        let totalPrice = cart.totalPrice
        const deliveryCharge = totalPrice > 1000 ? 0 : 50;
        const platformFee = 10;
        const discount = 0;


        res.render('user/payment', {
            address,
            cartItems: cart.items,
            summary: {
                totalItems: cart.totalItem,
                totalPrice: cart.totalPrice,
                deliveryCharge,
                platformFee,
                discount,
                finalAmount:
                    cart.totalPrice + deliveryCharge + platformFee - discount,
            },
        });
    } catch (err) {
        next(new AppError(err.message, HTTP_STATUS.INTERNAL_SERVER_ERROR))
    }
};
const placeOrder = async (req, res, next) => {
    try {
        const userId = req.session.user
        const { paymentMethod } = req.body
        const checkout = req.session.checkout

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
        const orderItems = cart.items.map(item => ({
            productId: item.productId._id,
            variantId:item.variantId._id,
            productName: item.productId.productname,
            quantity: item.quantity,
            price: item.variantId.price,
            image:item.variantId.images[0],
            itemStatus: "pending"
        }))
        
        const totalItems = cart.items.reduce((sum, item) => sum + item.quantity,0)
        const orderId = `ORD${Date.now()}`
        const order = await Order.create({
            orderId,
            userId,
            
            paymentMethod,
            totalItems,
            totalPrice: checkout.totalPrice,
            deliveryCharge: checkout.deliveryCharge,
            platformFee: checkout.platformFee,
            discount: checkout.discount,
            orderStatus: "pending",
            orderItems,
            address: {
                addressType: address.addressType,
                addressLine:address.addressLine,
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
                totalAmount: order.totalPrice
            }
        });


    } catch (err) {
        next(err)
    }
}


module.exports = {
    getCheckout,
    checkoutContinue,
    getPaymentPage,
    placeOrder,
    getOrderSuccess
}