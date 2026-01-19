const Offer = require('../models/offerSchema')
const Product=require('../models/productSchema')
const Category=require('../models/categorySchema')
const AppError = require('../config/AppError')
const HTTP_STATUS = require('../middleware/statusCode')

const getOfferlist = async (req, res, next) => {
    try {
        const search = req.query.search || ""
        const page = parseInt(req.query.page) || 1
        const limit = 6

        let filter = {}
        if (search) {
            filter = { name: { $regex: '.*' + search + '.*', $options: 'i' } }
        }
        const count = await Offer.countDocuments(filter)
        const totalPages = Math.ceil(count / limit)

        const offers = await Offer.find(filter)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            const products = await Product.find(
      { isListed: true },
      { productname: 1 }
    );

    const categories = await Category.find(
      { isListed: true },
      { name: 1 }
    );
        res.render('admin/offers', {
            offers,
            products,
            categories,
            page,
            search,
            totalPages
        })
    } catch (err) {
        next(err)
    }
}
const addOffer = async (req, res, next) => {
    try {
        const {
            name,
            type,
            discountType,
            discountValue,
            productId,
            categoryId,
            startDate,
            endDate
        } = req.body;

        if (type === "PRODUCT" && !productId) {
            throw new Error("Product offer requires productId",HTTP_STATUS.BAD_REQUEST);
        }

        if (type === "CATEGORY" && !categoryId) {
            throw new Error("Category offer requires categoryId",HTTP_STATUS.BAD_REQUEST);
        }

        if (discountType === "PERCENT" && discountValue > 90) {
            throw new Error("Percent discount too high",HTTP_STATUS.BAD_REQUEST);
        }

        if (new Date(startDate) >= new Date(endDate)) {
            throw new Error("Invalid offer date range",HTTP_STATUS.BAD_REQUEST);
        }

        await Offer.create({
            name,
            type,
            discountType,
            discountValue,
            productId: type === "PRODUCT" ? productId : null,
            categoryId: type === "CATEGORY" ? categoryId : null,
            startDate,
            endDate
        });

        res.status(HTTP_STATUS.CREATED).json({
            success:true,
            message:'Offer created succesfully'})

    } catch (err) {
        next(err)
    }
}
const editOffer = async (req, res, next) => {
    try {
    const { id } = req.params;
    
    const {
      name,
      discountValue,
      startDate,
      endDate
    } = req.body;

    if (!discountValue || !startDate || !endDate) {
      throw new AppError('Discount value and dates are required',HTTP_STATUS.BAD_REQUEST)
    }

    const offer = await Offer.findById(id);

    if (!offer) {
      throw new AppError('Offer not found',HTTP_STATUS.NOT_FOUND)
    }

    offer.discountValue = discountValue;
    offer.startDate = startDate;
    offer.endDate = endDate;

    if (name) {
      offer.name = name;
    }
    await offer.save();
    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Offer updated successfully'
    })
} catch (err) {
        next(err)
    }
}
const removeOffer = async (req, res, next) => {
    try {
        const { id } = req.params

    const offer = await Offer.findById(id);
    if (!offer) {
      return res.status(404).json({ success: false, message: 'Offer not found' });
    }

    offer.isActive = false;
    await offer.save();

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Offer deactivated successfully'
    });

    } catch (err) {
        next(err)
    }
}

module.exports = {
    getOfferlist,
    addOffer,
    editOffer,
    removeOffer
}