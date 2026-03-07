const AppError = require('../config/AppError')
const HTTP_STATUS = require('../middleware/statusCode')
const Orders=require('../models/orderSchema')
const User=require('../models/userSchema')
const Variant=require('../models/varientSchema')
const Product=require('../models/productSchema')
const Wallet=require('../models/walletSchema')
const WalletTransaction=require('../models/walletTransactionSchema')

const getOrder = async (req, res, next) => {
  try {
    const search = req.query.search || '';
    const status = req.query.status || '';
    const sort = req.query.sort || 'newest-oldest';
    const page = parseInt(req.query.page) || 1;
    const limit = 8;

    const query = {};

    // 🔎 Search by Order ID OR Username
    if (search) {
      const users = await User.find({
        fullName: { $regex: search, $options: 'i' }
      }).select('_id');

      query.$or = [
        { orderId: { $regex: search, $options: 'i' } },
        { userId: { $in: users.map(u => u._id) } }
      ];
    }

    // 📦 Order-level status filter
    if (status) {
      query.orderStatus = status; // must exist in schema
    }

    const totalOrders = await Orders.countDocuments(query);
    const totalPages = Math.ceil(totalOrders / limit);

    const orders = await Orders.find(query)
      .populate('userId') 
      .sort({ createdAt: sort === 'oldest-newest' ? 1 : -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.render('admin/order', {
      orders,
      page,
      totalPages,
      search,
      status,
      sort
    });

  } catch (err) {
    next(err);
  }
};

// 
const getOrderDetailPage = async (req, res, next) => {
  try {
    const orderId=req.params.orderId
    const order = await Orders.findOne({orderId})
      .populate('userId')
      


    res.render('admin/order-details', { order });

  } catch (err) {
    next(err);
  }
};


const updateStatus=async(req,res,next)=>{
     try {
    const { orderId, itemId, itemStatus } = req.body;

    if (!orderId || !itemId || !itemStatus) {
      throw new AppError('Missing required fields', HTTP_STATUS.BAD_REQUEST);
    }

    const order = await Orders.findById(orderId );

    if (!order) {
      throw new AppError('Order not found', HTTP_STATUS.NOT_FOUND);
    }

    const item = order.orderItems.id(itemId);
    if (item.itemStatus === 'delivered') {
      throw new AppError("Delivered items cannot be modified",HTTP_STATUS.BAD_REQUEST)
    }

    if (!item) {
      throw new AppError('Order item not found', HTTP_STATUS.NOT_FOUND);
    }

    const previousStatus = item.itemStatus;

    
    item.itemStatus = itemStatus;
    if(itemStatus==='delivered' && previousStatus!=='delivered'){
      item.deliveryDate=new Date()
    }
    const restoreStatuses = [ 'returned'];

    if (
      restoreStatuses.includes(itemStatus) &&
      !restoreStatuses.includes(previousStatus)
    )
     {
      await Variant.findByIdAndUpdate(item.variantId, {
        $inc: { stock: item.quantity }
      });
      await Product.findByIdAndUpdate(item.productId,{
         $inc: { totalStock: item.quantity } 
      })
    }

const statuses = order.orderItems.map(i => i.itemStatus);

const all = s => statuses.every(x => x === s);
const some = s => statuses.some(x => x === s);
if (all('cancelled')) {
  order.orderStatus = 'cancelled';
}
else if (all('returned')) {
  order.orderStatus = 'returned';
}
else if (all('delivered')) {
  order.orderStatus = 'delivered';
}
else if (some('return_requested')) {
  order.orderStatus = 'return_requested';
}
else if (some('returning')) {
  order.orderStatus = 'returning';
}
else if (some('returned')) {
  order.orderStatus = 'partially_returned';
}
else if (some('delivered')) {
  order.orderStatus = 'partially_delivered';
}
else if (some('cancelled')) {
  order.orderStatus = 'partially_cancelled';
}
else if (some('shipped')) {
  order.orderStatus = 'processing';
}
else if (all('confirmed')) {
  order.orderStatus = 'confirmed';
}
else {
  order.orderStatus = 'pending';
}
await order.save();

return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Item status updated',
      itemStatus
    });

}catch(err){
    next(err)
}
}


const approveReturn = async (req, res, next) => {
  try {
    const { orderId, itemId } = req.body
    console.log(orderId,itemId)
    const order = await Orders.findById(orderId );
    
    if (!order) throw new AppError('Order not found', HTTP_STATUS.NOT_FOUND);

    const item = order.orderItems.id(itemId);
    if (!item) throw new AppError('Item not found', HTTP_STATUS.NOT_FOUND);

    if (item.itemStatus !== 'return_requested') {
      throw new AppError('Return not possible', HTTP_STATUS.BAD_REQUEST);
    }

    item.itemStatus = 'returned';
    if (item.returnReason && item.returnReason.toLowerCase() === 'product damaged') {
        await Variant.findByIdAndUpdate(item.variantId, {
        $inc: { damagedStock: item.quantity }
      });
    
    } else {
        await Variant.findByIdAndUpdate(item.variantId, {
        $inc: { stock: item.quantity }
      });
    
    }

    if (item.returnReason !== 'damaged') {
    await Product.findByIdAndUpdate(item.productId, {
      $inc: { totalStock: item.quantity }
    });
  }

    
    const refundAmount = item.finalItemAmount;
    if (item.isRefunded) {
      throw new AppError('Already refunded', HTTP_STATUS.BAD_REQUEST);
    }

    if (order.paymentMethod !== 'COD') {
      let wallet = await Wallet.findOne({ userId: order.userId });
      if (!wallet) wallet = await Wallet.create({ userId: order.userId });

      wallet.balance += refundAmount;
      await wallet.save();

      await WalletTransaction.create({
        userId: order.userId,
        type: 'CREDIT',
        amount: refundAmount,
        reason: `Refund for returned item (${item.productName})`,
        orderId: order.orderId,
        balanceAfter:wallet.balance
      });
    }
// order.finalAmount -= refundAmount
item.refundAmount = refundAmount;
item.isRefunded = true;
    
    const statuses = order.orderItems.map(i => i.itemStatus);
    if (statuses.every(s => s === 'returned')) {
      order.orderStatus = 'returned';
    }

    await order.save();

    res.json({
      success: true,
      message: 'Return approved and wallet refunded'
    });

  } catch (err) {
    next(err);
  }
};
const rejectReturn = async (req, res, next) => {
  try {
    const { orderId, itemId } = req.body;

    const order = await Orders.findById(orderId);
    if (!order) {
      throw new AppError('Order not found', HTTP_STATUS.BAD_REQUEST);
    }

    const item = order.orderItems.id(itemId);
    if (!item) {
      throw new AppError('Order item not found', HTTP_STATUS.BAD_REQUEST);
    }

    if (item.itemStatus !== 'return_requested') {
      throw new AppError('Return not possible', HTTP_STATUS.BAD_REQUEST);
    }
    const result = await Orders.updateOne(
      {
        _id: orderId,
        "orderItems._id": itemId,
        "orderItems.itemStatus": "return_requested"
      },
      {
        $set: {
          "orderItems.$.itemStatus": "delivered"
        }
      }
    );

    if (result.modifiedCount === 0) {
      throw new AppError("Return not possible or item not found",HTTP_STATUS.BAD_REQUEST)
    }
    res.json({
      success: true,
      message: 'Return request rejected'
    });

  } catch (err) {
    next(err);
  }
};



module.exports={
    getOrder,
    getOrderDetailPage,
    updateStatus,
    approveReturn,
    rejectReturn

}