const Cart = require('../models/cartSchema')
const Orders = require('../models/orderSchema')
const Variant = require('../models/varientSchema')
const Product=require('../models/productSchema')
const User = require('../models/userSchema')
const AppError = require('../config/AppError')
const HTTP_STATUS = require('../middleware/statusCode')
const notFound = require('../middleware/notFound')
const PDFDocument = require('pdfkit')
const {creditWallet}= require('../helpers/wallet')
const razorpay=require('../config/razorpay')
const getOrders = async (req, res, next) => {
  try {
    const page=parseInt(req.query.page) ||1
    const limit=6

    const userId = req.session.user;
    if (!userId) {
      throw new AppError('Please Login', HTTP_STATUS.UNAUTHORIZED)
    }
    const user = await User.findById(userId).select('fullName')
     const search = req.query.search || ''
     const {status}=req.query
     
     const filter = { userId };

    if (search) {
      filter.orderId = { $regex: search, $options: 'i' };
    }
    if (status) {
      filter.orderStatus = status;
    }

    const totalOrders=await Orders.countDocuments(filter)
    const totalPages=Math.ceil(totalOrders/limit)
    const orders = await Orders.find(filter)
      .sort({ createdAt: -1 })
      .skip((page-1)*limit)
      .limit(limit)

    res.render('user/profile/orders',
      { orders,
        search,
        status,
        page,
        totalPages
        
       });

  } catch (err) {
    next(err)
  }

}

const getOrderDetails = async (req, res, next) => {
  try {
    const { orderId } = req.params
    const userId = req.session.user
    if (!userId) {
      throw new AppError('Please Login', HTTP_STATUS.BAD_REQUEST)
    }
    const user = await User.findById(userId).select('fullName')

    const order = await Orders.findOne({ orderId, userId })
      .sort({ createdAt: -1 })

    if (!orderId) {
      throw new AppError('Order not found', HTTP_STATUS.NOT_FOUND)
    }

    res.render('user/profile/orderDetails',
      { order });

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

 // 3️⃣ Refund amount = EXACT amount user paid
    const refundAmount = item.finalItemAmount;

    // 4️⃣ Refund only if prepaid
    if (order.paymentMethod !== 'COD') {

      // Razorpay → refund gateway (optional but correct)
      if (
        order.paymentMethod === 'RAZORPAY' &&
        order.payment?.razorpay?.paymentId
      ) {
        await razorpay.payments.refund(
          order.payment.razorpay.paymentId,
          { amount: refundAmount * 100 }
        );
      }
      const userId =typeof req.session.user === 'object'? req.session.user._id: req.session.user;
      await creditWallet({
          amount: refundAmount,
          reason: `Refund for cancelled item ${item.productName}`,
          orderId:order.orderId,
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

    if ( item.itemStatus !== 'delivered') {
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
      success: true ,
      message:'Return request submitted'
    });
  } catch (err) {
    next(err);
  }
};
const downloadInvoice = async (req, res, next) => {
  try {
    const userId = req.session.user;
    const { orderId } = req.params;

    const order = await Orders.findOne({ orderId });

    if (!order) {
      throw new AppError('Order not found', HTTP_STATUS.NOT_FOUND)

    }

    if (order.userId.toString() !== userId.toString()) {
      throw new AppError('Unauthorized', HTTP_STATUS.UNAUTHORIZED);
    }

    // PDF headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=invoice-${order.orderId}.pdf`
    );

    const doc = new PDFDocument({ margin: 40 });
    doc.pipe(res);
    const margin = 40;
    const pageWidth = 595.28; // A4
    const usableWidth = pageWidth - margin * 2;

    let y = 50;


    /* ---------- HEADER ---------- */
    doc
      .fontSize(20)
      .text('INVOICE', margin, y, { align: 'center' });

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
      .text(`${order.address.name}`, margin + 10, y + 25)
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

    /* ---------- ITEMS ---------- */
    order.orderItems.forEach(item => {
      const rowHeight = 18;

      doc
        .fontSize(9)
        .text(item.productName, col.name, y, { width: 250 })
        .text(item.quantity.toString(), col.qty, y)
        .text(`₹${item.price}`, col.price, y)
        .text(`₹${item.price * item.quantity}`, col.total, y);

      y += rowHeight;
    });


    /* ---------- TOTALS ---------- */
    y += 20;

    doc
      .fontSize(10)
      .text(`Subtotal: ₹${order.totalPrice}`, col.total - 80, y, { align: 'right' });

    y += 15;
    doc.text(`Delivery: ₹${order.deliveryCharge}`, col.total - 80, y, { align: 'right' });

    y += 15;
    doc.text(`Platform Fee: ₹${order.platformFee}`, col.total - 80, y, { align: 'right' });

    y += 15;
    doc.fontSize(12).text(`Grand Total: ₹${order.totalPrice + order.deliveryCharge + order.platformFee}`,
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
    {
      width: usableWidth, 
      align: 'center'
    }
  );


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