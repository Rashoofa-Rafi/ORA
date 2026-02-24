const Cart = require('../models/cartSchema')
const Orders = require('../models/orderSchema')
const Variant = require('../models/varientSchema')
const Product = require('../models/productSchema')
const User = require('../models/userSchema')
const AppError = require('../config/AppError')
const HTTP_STATUS = require('../middleware/statusCode')
const notFound = require('../middleware/notFound')
const PDFDocument = require('pdfkit')
const { creditWallet } = require('../helpers/wallet')
const razorpay = require('../config/razorpay')
const getOrders = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = 6

    const userId = req.session.user
    if (!userId) {
      throw new AppError('Please Login', HTTP_STATUS.UNAUTHORIZED)
    }

    const search = req.query.search || ''
    const status = req.query.status || ''

    const filter = { userId }

    if (search) {
      filter.orderId = { $regex: search, $options: 'i' }
    }

    if (status) {

      filter.orderStatus = status
    }

    const orders = await Orders.find(filter)
      .populate('orderItems.productId')
      .populate('orderItems.variantId')
      .sort({ createdAt: -1 })


    const itemList = []

    orders.forEach(order => {
      order.orderItems.forEach(item => {
        itemList.push({
          orderId: order.orderId,
          createdAt: order.createdAt,
          paymentMethod: order.paymentMethod,
          paymentStatus: order.payment.status,
          orderStatus: order.orderStatus,
          

          // item-specific
          itemId: item._id,
          product: item.productId,
          variant: item.variantId,
          productName: item.productName,
          quantity: item.quantity,
          price: item.variantId.price,
          image: item.image,
          itemStatus: item.itemStatus,
          finalItemAmount: item.finalItemAmount,
          expectedDelivery: item.expectedDelivery
        })
      })
    })

    // ITEM LEVEL PAGINATION
    const totalItems = itemList.length
    const totalPages = Math.ceil(totalItems / limit)

    const paginatedItems = itemList.slice(
      (page - 1) * limit,
      page * limit
    )

    res.render('user/profile/orders', {
      orders: paginatedItems,
      
      page,
      totalPages,
      search,
      status
    })

  } catch (err) {
    next(err)
  }
}


const getOrderDetails = async (req, res, next) => {
  try {
    const { orderId, itemId } = req.params
    const userId = req.session.user
    if (!userId) {
      throw new AppError('Please Login', HTTP_STATUS.BAD_REQUEST)
    }
    const user = await User.findById(userId).select('fullName')

    const order = await Orders.findOne({ orderId, userId, 'orderItems._id': itemId })
      .populate('orderItems.productId')
      .populate('orderItems.variantId')
      .sort({ createdAt: -1 })

if (!orderId) {
  throw new AppError('Order not found', HTTP_STATUS.NOT_FOUND)
}

res.render('user/profile/orderDetails',
  { order ,itemId});

  } catch (err) {
  next(err)
}

}
const cancelOrderItem = async (req, res, next) => {
  try {
    const userId = req.session.user;
    const { orderId, itemId } = req.params;
    const { reason } = req.body;


    const order = await Orders.findOne({ orderId, userId });
    if (!order) throw new AppError('Order not found', 404);

    const item = order.orderItems.id(itemId);
    if (!item) throw new AppError('Item not found', 404);

    if (!['pending', 'confirmed'].includes(item.itemStatus)) {
      throw new AppError('Item cannot be cancelled now', HTTP_STATUS.BAD_REQUEST);
    }

    // update item
    item.itemStatus = 'cancelled';
    item.cancellationReason = reason || null;

    // restore stock
    await Variant.findByIdAndUpdate(
      item.variantId,
      { $inc: { stock: item.quantity } }
    );
    await Product.findByIdAndUpdate(
      item.productId,
      { $inc: { totalStock: item.quantity } }
    );

   const refundAmount = item.finalItemAmount;

    if (order.paymentMethod !== 'COD') {

      // Razorpay → refund gateway 
      if (
        order.paymentMethod === 'RAZORPAY' &&
        order.payment?.razorpay?.paymentId
      ) {
        await razorpay.payments.refund(
          order.payment.razorpay.paymentId,
          { amount: refundAmount * 100 }
        );
      }
      const userId = typeof req.session.user === 'object' ? req.session.user._id : req.session.user;
      await creditWallet({
        amount: refundAmount,
        reason: `Refund for cancelled item ${item.productName}`,
        orderId: order.orderId,
        userId
      });

      item.refundAmount = refundAmount;
      item.isRefunded = true;
    }

    // update order status if needed
    const statuses = order.orderItems.map(i => i.itemStatus);

    if (statuses.every(s => s === 'cancelled')) {
      order.orderStatus = 'cancelled';
    } else {
      order.orderStatus = 'partially_cancelled';
    }
    await order.save();

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Order cancelled and wallet refunded if applicable'
    });
  } catch (err) {
    next(err);
  }
};
const returnOrderItem = async (req, res, next) => {
  try {
    const userId = req.session.user;
    const { orderId, itemId } = req.params;

    const { reason } = req.body;

    if (!reason) {
      throw new AppError('Return reason is required', HTTP_STATUS.BAD_REQUEST);
    }

    const order = await Orders.findOne({ orderId, userId });
    if (!order) throw new AppError('Order not found', HTTP_STATUS.NOT_FOUND);



    const item = order.orderItems.id(itemId);
    if (!item) throw new AppError('Item not found', HTTP_STATUS.NOT_FOUND);

    if (item.itemStatus !== 'delivered') {
      throw new AppError('Only delivered item can be returned', HTTP_STATUS.BAD_REQUEST);
    }

    item.itemStatus = 'return_requested';
    item.returnReason = reason;

    const statuses = order.orderItems.map(i => i.itemStatus);

    if (statuses.every(s => s === 'return_requested')) {
      order.orderStatus = 'return_requested';
    } else {
      order.orderStatus = 'partially_returned';
    }

    await order.save();

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Return request submitted'
    });
  } catch (err) {
    next(err);
  }
};
const downloadInvoice = async (req, res, next) => {
  try {
    const userId = req.session.user;
    const { orderId, itemId } = req.params;

    const order = await Orders.findOne({userId,
      orderId,
      'orderItems._id': itemId
    });

    if (!order) {
      throw new AppError('Order not found', HTTP_STATUS.NOT_FOUND);
    }

   

    // extract the single item
    const item = order.orderItems.find(
      i => i._id.toString() === itemId.toString()
    );

    if (!item) {
      throw new AppError('Item not found', HTTP_STATUS.NOT_FOUND);
    }

    /* ---------- PDF HEADERS ---------- */
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=invoice-${order.orderId}-${item._id}.pdf`
    );

    const doc = new PDFDocument({ margin: 40 });
    doc.pipe(res);

    const margin = 40;
    const pageWidth = 595.28;
    const usableWidth = pageWidth - margin * 2;
    let y = 50;

    /* ---------- HEADER ---------- */
    doc
      .fontSize(20)
      .text('ORA', margin, y, { align: 'center' });

    y += 40;

    doc
      .fontSize(10)
      .text(`Order ID: ${order.orderId}`, margin, y)
      .text(`Date: ${order.createdAt.toDateString()}`, pageWidth - 200, y);

    y += 30;

    /* ---------- ADDRESS ---------- */
    doc.rect(margin, y, usableWidth, 80).stroke();

    doc
      .fontSize(10)
      .text('Billing Address', margin + 10, y + 8)
      .text(order.address.name, margin + 10, y + 25)
      .text(`${order.address.locality}, ${order.address.city}`, margin + 10, y + 40)
      .text(`${order.address.state} - ${order.address.pincode}`, margin + 10, y + 55);

    y += 100;

    /* ---------- TABLE HEADER ---------- */
    const col = {
      name: margin,
      qty: margin + 260,
      price: margin + 330,
      total: margin + 420
    };

    doc
      .fontSize(10)
      .text('Product', col.name, y)
      .text('Qty', col.qty, y)
      .text('Price', col.price, y)
      .text('Total', col.total, y);

    y += 15;
    doc.moveTo(margin, y).lineTo(pageWidth - margin, y).stroke();
    y += 10;

    /* ---------- SINGLE ITEM ---------- */
    doc
      .fontSize(9)
      .text(item.productName, col.name, y, { width: 250 })
      .text(item.quantity.toString(), col.qty, y)
      .text(`₹${item.price}`, col.price, y)
      .text(`₹${item.price * item.quantity}`, col.total, y);

    y += 30;

    /* ---------- TOTALS ---------- */
    const subtotal = item.price * item.quantity;
    const Discount=item.offerDiscount ||0
    const coupon = item.couponShare || 0
    const finalAmount = item.finalItemAmount || subtotal - coupon;

    doc.fontSize(10);
    doc.text(`Subtotal: ₹${subtotal}`, col.total - 80, y, { align: 'right' });
    y += 15;
    doc.text(`Offer Discount: -₹${Discount}`, col.total - 80, y, { align: 'right' });

    y += 15;
    doc.text(`Coupon Discount: -₹${coupon}`, col.total - 80, y, { align: 'right' });

    y += 15;
    doc.fontSize(12).text(
      `Final Amount: ₹${finalAmount}`,
      col.total - 80,
      y,
      { align: 'right' }
    );

    /* ---------- FOOTER ---------- */
    doc
      .moveDown(2)
      .fontSize(10)
      .text(
        'Thank you for shopping with ORA.',
        margin,
        doc.y,
        { width: usableWidth, align: 'center' }
      );

    doc.end();

  } catch (err) {
    next(err);
  }
};



module.exports = {
  getOrders,
  getOrderDetails,
  cancelOrderItem,
  returnOrderItem,
  downloadInvoice
}