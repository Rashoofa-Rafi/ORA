const HTTP_STATUS = require('../middleware/statusCode.js');
const AppError=require('../config/AppError')
const Customer = require('../models/userSchema.js');

const customerInfo = async (req, res,next) => {
  try {
    let search = req.query.search || ''
    let page = parseInt(req.query.page) || 1
    const limit = 10;

    const query = {
      role: 'user',
      $or: [
        {fullName:{$regex: '.*' + search + '.*', $options: 'i'}},
        {email:{$regex: '.*' + search + '.*', $options: 'i'}}
      ],
    }

    
    const count = await Customer.countDocuments(query)

    // list users (sorted)
    // const customers = await Customer.find(query)
    //   .sort({ createdAt: -1 })
    //   .limit(limit)
    //   .skip((page - 1) * limit)
    //   .exec();
const customers = await Customer.aggregate([
  { $match: query },
  { $sort: { createdAt: -1 } },
  { $skip: (page - 1) * limit },
  { $limit: limit },
  {
    $lookup: {
      from: "orders",
      localField: "_id",
      foreignField: "userId",
      as: "orders"
    }
  },
  {
    $lookup: {
      from: "wallets",
      localField: "_id",
      foreignField: "userId",
      as: "wallet"
    }
  },
  {
    $addFields: {
      orderCount: { $size: "$orders" },
      walletBalance: { $ifNull: [{ $arrayElemAt: ["$wallet.balance", 0] }, 0] }
    }
  },
  {
    $project: {
      orders: 0,
      wallet: 0
    }
  }
]);

    const totalPages = Math.ceil(count / limit)

    res.render('admin/customer', {
      customers, 
      search,
      page,
      totalPages,
      currentPath: req.path
    });
  } catch (err) {
      next(new AppError(err.message ,HTTP_STATUS.INTERNAL_SERVER_ERROR))
  }
};

const blockStatus= async(req,res,next)=>{
    try {
        const { id, action } = req.body

    const isBlocked = action === 'block'
    await Customer.findByIdAndUpdate(id, { isBlocked });
        res.status(HTTP_STATUS.CREATED).json({
            success:true,
            message: `Customer ${isBlocked ? 'blocked' : 'unblocked'} successfully`,
        })
     
    } catch (err) {
         next(new AppError(err.message ,HTTP_STATUS.INTERNAL_SERVER_ERROR))
    }
}


module.exports = { customerInfo,blockStatus };
