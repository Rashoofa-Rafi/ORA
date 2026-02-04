const mongoose = require('mongoose')
const Product = require('../models/productSchema')
const Variant = require('../models/varientSchema')
const Order = require('../models/orderSchema')
const Coupon = require('../models/couponSchema')
const User = require('../models/userSchema')
const Cart = require('../models/cartSchema')
const Wallet = require('../models/walletSchema')
const WalletTransaction = require('../models/walletTransactionSchema')

async function finalizeOrder(orderId) {
  const order = await Order.findOneAndUpdate(
    { _id: orderId, isFinalized: false },
    { $set: { isFinalized: true } },
    { new: true }
  );
  if (!order) return;
  const userId = new mongoose.Types.ObjectId(order.userId);
  order.isFinalized = true;
  await order.save();
  const deleted = await Cart.deleteOne({ userId });
  // stock reduce
  for (const item of order.orderItems) {
    await Variant.findOneAndUpdate({ _id: item.variantId, stock: { $gte: item.quantity } }, { $inc: { stock: -item.quantity } });
    await Product.findOneAndUpdate({ _id: item.productId, totalStock: { $gte: item.quantity } }, { $inc: { totalStock: -item.quantity } })
  }

  // // coupon
  // if (order.coupons) {
  //   const coupon = await Coupon.updateOne({_id: order.coupons.couponId, usedOrders: { $ne: order._id }},
  //                  {$inc: { usedCount: 1 },$push: { usedOrders: order._id }})
  //   }
  if (order.coupons && order.coupons.length > 0) {
  for (const coupon of order.coupons) {
    if (!coupon.couponId) continue; // skip invalid entries
    await Coupon.updateOne(
      { _id: coupon.couponId, usedOrders: { $ne: order._id } },
      { $inc: { usedCount: 1 }, $push: { usedOrders: order._id } }
    );
  }
}


    
  const user = await User.findById(userId);
  const confirmedCount = await Order.countDocuments({
    userId,
    isFinalized: true
  });

  if (confirmedCount === 1 && user.referredBy && !user.referralRewardApplied) {
    // referrer
   const wallet= await Wallet.updateOne(
      { userId: user.referredBy },
      { $inc: { balance: 100 } },
      { upsert: true }
    );

    await WalletTransaction.create({
      userId: user.referredBy,
      type: 'CREDIT',
      amount: 100,
      reason: 'REFERRAL_REWARD_REFERRER',
      orderId: order.orderId,
      balanceAfter:wallet.balance
    });

    // user reward
    await Wallet.updateOne(
      { userId },
      { $inc: { balance: 50 } },
      { upsert: true }
    );

    await WalletTransaction.create({
      userId,
      type: 'CREDIT',
      amount: 50,
      reason: 'REFERRAL_REWARD_USER',
      orderId: order.orderId,
      balanceAfter:wallet.balance
    });

    await user.save();
  console.log("✅ finalizeOrder COMPLETED for orderId:", orderId)

}
}

module.exports = { finalizeOrder }