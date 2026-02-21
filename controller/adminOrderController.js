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

    const matchStage = {};

    // Search by orderId OR username
    if (search) {
      const users = await User.find({fullName: { $regex: search, $options: 'i' }})
        .select('_id');

      matchStage.$or = [
        { orderId: { $regex: search, $options: 'i' } },
        { userId: { $in: users.map(u => u._id) } }
      ];
    }

    const pipeline = [
      { $match: matchStage },

      // explode items
      { $unwind: '$orderItems' }
    ];

    // Filter by ITEM status (IMPORTANT)
    if (status) {
      pipeline.push({$match: { 'orderItems.itemStatus': status }});
    }

    // Join user
    pipeline.push(
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' }
    );

    // Sorting
    pipeline.push({
      $sort: {
        createdAt: sort === 'oldest-newest' ? 1 : -1
      }
    });

    // Pagination
    pipeline.push(
      { $skip: (page - 1) * limit },
      { $limit: limit }
    );

    const orders = await Orders.aggregate(pipeline);

    // Count for pagination
    const countPipeline = [...pipeline];
    countPipeline.splice(-2); // remove skip & limit
    countPipeline.push({ $count: 'total' });

    const countResult = await Orders.aggregate(countPipeline);
    const totalItems = countResult[0]?.total || 0;
    const totalPages = Math.ceil(totalItems / limit);

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
    const { itemId } = req.params;

    const order = await Orders.findOne({ "orderItems._id": itemId },
      {
        orderId: 1,
        userId: 1,
        address: 1,
        paymentMethod: 1,
        createdAt: 1,
        "orderItems.$": 1 
      }
    ).populate('userId', 'fullName email mobile')
    .populate({
      path:'orderItems.variantId',
      select:'price'
    })
    

    if (!order || !order.orderItems.length) {
      throw new AppError('Order item not found', HTTP_STATUS.NOT_FOUND);
    }

    const items = order.orderItems[0];

    res.render('admin/order-details', {
      order,
      items
    });

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

    await Variant.findByIdAndUpdate(item.variantId, {
      $inc: { stock: item.quantity }
    });

    await Product.findByIdAndUpdate(item.productId, {
      $inc: { totalStock: item.quantity }
    });

    
    const refundAmount = item.finalItemAmount;

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
order.finalAmount -= refundAmount
    
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