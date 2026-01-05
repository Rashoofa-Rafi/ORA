const AppError = require('../config/AppError')
const HTTP_STATUS = require('../middleware/statusCode')
const Orders=require('../models/orderSchema')
const User=require('../models/userSchema')
const Variant=require('../models/varientSchema')
const Product=require('../models/productSchema')


const getOrder= async(req,res,next)=>{
    try {
  const search = req.query.search || '';
  const status = req.query.status || '';
  const sort = req.query.sort ;
  const page = parseInt(req.query.page) || 1;
  const limit = 6;

  let query = {};

  
  if (search) {
    const users = await User.find({
      fullName: { $regex: search, $options: 'i' }
    }).select('_id');

    const userIds = users.map(u => u._id);

    query.$or = [
      { orderId: { $regex: search, $options: 'i' } },
      { userId: { $in: userIds } }
    ];
  }

  //FILTER
  if (status) {
    query.orderStatus = status;
  }

  //SORT 
  let sortOption = {};
  if (sort === 'oldest-newest') {
    sortOption.createdAt = 1;
  } else {
    sortOption.createdAt = -1;
  }

  
  const orders = await Orders.find(query)
    .populate('userId', 'fullName email')
    .sort(sortOption)
    .skip((page - 1) * limit)
    .limit(limit);

  const totalOrders = await Orders.countDocuments(query);
  const totalPages = Math.ceil(totalOrders / limit);

  res.render('admin/order', {
    orders,
    page,
    totalPages,
    search,
    status,
    sort,
    currentPath: req.path
  });

} catch (error) {
  next(error);
}

}
const getOrderDetailPage= async(req,res,next)=>{
    try {
        const {orderId}=req.params
        
        const order= await Orders.findOne({orderId})
        .populate('userId', 'fullName email mobile')

        if(!order){
            throw new AppError('No order found',HTTP_STATUS.NOT_FOUND)
        }
        res.render('admin/order-details',{
            order
        })
        
    } catch (err) {
        next(err)
    }
}

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

module.exports={
    getOrder,
    getOrderDetailPage,
    updateStatus

}