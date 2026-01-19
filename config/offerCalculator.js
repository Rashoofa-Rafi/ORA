const Offer=require('../models/offerSchema')

module.exports.calculateItemPrice = async (product, variant,categoryId) => {
  const basePrice = variant.price;
  let finalPrice = basePrice;
  let appliedOffer = null;
  let maxDiscountAmount = 0;

  const now = new Date();

  const offers = await Offer.find({
    isActive: true,
    startDate: { $lte: now },
    endDate: { $gte: now },
    $or: [
      { type: 'PRODUCT', productId: product._id },
      { type: 'CATEGORY', categoryId: categoryId }
    ]
  });

  for (const offer of offers) {
    let discountAmount = 0;

    if (offer.discountType === 'PERCENTAGE') {
      discountAmount = (basePrice * offer.discountValue) / 100;
    } else {
      discountAmount = offer.discountValue;
    }

    if (discountAmount > maxDiscountAmount) {
      maxDiscountAmount = discountAmount;
      appliedOffer = offer;
    }
  }

  finalPrice = Math.max(basePrice - maxDiscountAmount, 0);

  return {
    basePrice,
    discountAmount: Math.round(maxDiscountAmount),
    finalPrice: Math.round(finalPrice),
    appliedOffer
  };
};
