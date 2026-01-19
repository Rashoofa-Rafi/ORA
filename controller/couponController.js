const HTTP_STATUS = require('../middleware/statusCode.js');
const AppError = require('../config/AppError')
const Coupon = require('../models/couponSchema.js')
const User=require('../models/userSchema.js')

const getCouponlist = async (req, res, next) => {
    try {
        const search = req.query.search || ''
        const page = parseInt(req.query.page) || 1
        const limit = 6

        let filter = {}
        if (search) {
            filter = { code: { $regex: '.*' + search + '.*', $options: 'i' } }
        }
        const coupons = await Coupon.find(filter)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)

        const totalCount = await Coupon.countDocuments(filter)
        const totalPages = Math.ceil(totalCount / limit)

        return res.render('admin/coupons', {
            coupons,
            totalPages,
            page,
            search,
            currentPath: req.path
        })

    } catch (err) {
        next(err)
    }
}

const addCoupon = async (req, res, next) => {
    try {
        const {
            code,
            minOrderPrice,
            discountType,
            discountValue,
            usageLimit,
            endDate
        } = req.body;

        if (!code || !discountType || !endDate) {
            throw new AppError('Missing required fields', HTTP_STATUS.BAD_REQUEST);
        }

        await Coupon.create({
            code,
            minOrderPrice,
            discountType,
            discountValue,
            usageLimit,
            endDate: new Date(endDate)
        });

        res.status(HTTP_STATUS.CREATED).json({
            success:true,
             message: 'Coupon created successfully' 
            });

    } catch (err) {
        next(err)
    }
}
const editCoupon = async (req, res, next) => {
    try {
        const { id } = req.params;

        const coupon = await Coupon.findByIdAndUpdate(id, { ...req.body }, { new: true })

        if (!coupon) {
            throw new AppError('Coupon not found', HTTP_STATUS.BAD_REQUEST);
        }

        res.status(HTTP_STATUS.OK).json({
            success: true,
            message: 'Coupon updated successfully'
        })

    } catch (err) {
        next(err)
    }
}
const removeCoupon = async (req, res, next) => {
    try {
        const coupon = await Coupon.findById(req.params.id)

        if (!coupon) {
            throw new AppError('Coupon not found', HTTP_STATUS.BAD_REQUEST)
        }

        coupon.isActive = !coupon.isActive
        await coupon.save()

        res.status(HTTP_STATUS.OK).json({
            success: true,
            message: 'Coupon deactivated'
        })

    } catch (err) {
        next(err)
    }
}

const getReferral=async(req,res,next)=>{
    try {
        const userId = req.session.user;
    if (!userId) {
      throw new AppError('Please login', HTTP_STATUS.UNAUTHORIZED);
    }

    const user = await User.findById(userId).select(
      'fullName referralCode wallet'
    );

    if (!user) {
      throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
    }

    return res.render('user/profile/referral', {
      user
    });
        
    } catch (err) {
       next(err) 
    }
}
const getUserCoupon=async(req,res,next)=>{
    try {
        const userId = req.session.user;

    const user = await User.findById(userId).select('usedCoupons');

    const coupons = await Coupon.find({
      isActive: true,
      endDate: { $gte: new Date() }
    }).lean();

    const formattedCoupons = coupons.map(coupon => ({
      ...coupon,
      isUsed: user.usedCoupons.includes(coupon._id)
    }));

    res.render('user/profile/coupons', {
        coupons,
      coupons: formattedCoupons
    })
        
    } catch (err) {
        next (err)
    }
}
module.exports = {
    getCouponlist,
    addCoupon,
    editCoupon,
    removeCoupon,
    getReferral,
    getUserCoupon
}