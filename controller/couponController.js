const HTTP_STATUS = require('../middleware/statusCode.js');
const AppError = require('../config/AppError')
const Coupon = require('../models/couponSchema.js')
const User=require('../models/userSchema.js')

const getCouponlist = async (req, res, next) => {
    try {
        const search = req.query.search || ''
        const page = parseInt(req.query.page) || 1
        const limit = 6
        const today = new Date()
        await Coupon.updateMany({endDate: { $lt: today },isActive: true},
            { $set: { isActive: false } }
          );

        await Coupon.updateMany({$expr: { $gte: ["$usedCount", "$usageLimit"] },isActive: true},
          {$set: { isActive: false }}
          )
        let filter = {}
        if (search) {
            filter = { code: { $regex: '.*' + search + '.*', $options: 'i' } }
        }
        
        
        const coupons = await Coupon.find({...filter,isDeleted:false})
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
const generateCouponCode = async (req, res, next) => {
    try {
  
      const generateCode = (length = 8) => {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let code = "";
  
        for (let i = 0; i < length; i++) {
          code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
  
        return code;
      };
  
      let code;
      let exists = true;
  
      while (exists) {
        code = generateCode(8);
        exists = await Coupon.findOne({ code });
      }
  
      res.status(200).json({
        success: true,
        code
      });
  
    } catch (err) {
      next(err);
    }
  };

const addCoupon = async (req, res, next) => {
    try {
        const {
            code,
            minOrderPrice,
            discountType,
            discountValue,
            maxDiscount,
            usageLimit,
            endDate
        } = req.body;

        if (!code || !discountType || !endDate) {
            throw new AppError('Missing required fields', HTTP_STATUS.BAD_REQUEST);
        }
        if (discountValue <= 0) {
          throw new AppError('Discount value must be greater than 0', HTTP_STATUS.BAD_REQUEST);
      }

      if (minOrderPrice && minOrderPrice <= 0) {
          throw new AppError('Minimum order price must be positive', HTTP_STATUS.BAD_REQUEST);
      }
      if (discountType === 'PERCENTAGE') {

        if (discountValue > 90) {
            throw new AppError('Percentage discount too high', HTTP_STATUS.BAD_REQUEST);
        }

        if (!maxDiscount || maxDiscount <= 0) {
            throw new AppError('Valid max discount required for percentage coupon', HTTP_STATUS.BAD_REQUEST);
        }
    }

   if (discountType === 'FIXED') {

        if (!minOrderPrice) {
            throw new AppError('Minimum order price required for fixed coupon', HTTP_STATUS.BAD_REQUEST);
        }

        if (discountValue >= minOrderPrice) {
            throw new AppError('Discount value cannot be greater than or equal to minimum order price',HTTP_STATUS.BAD_REQUEST)
          }
    }
    if (new Date(endDate) <= new Date()) {
        throw new AppError('End date must be in the future', HTTP_STATUS.BAD_REQUEST);
    }


        await Coupon.create({
            code,
            minOrderPrice,
            discountType,
            discountValue,
            usageLimit,
            endDate: new Date(endDate),
            maxDiscount: discountType === 'PERCENTAGE' ? maxDiscount : null
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

        const updatedData = {
            code: req.body.code,
            minOrderPrice: req.body.minOrderPrice,
            discountType: req.body.discountType,
            discountValue: req.body.discountValue,
            usageLimit: req.body.usageLimit,
            endDate: new Date(req.body.endDate),
            maxDiscount: req.body.discountType === 'PERCENTAGE'
              ? req.body.maxDiscount
              : null
          };

        const coupon = await Coupon.findByIdAndUpdate(id, updatedData, { new: true })

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

        
        coupon.isDeleted = true
    coupon.isActive = false
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
const getAvailableCoupons = async (req, res, next) => {
    try {
      const userId = req.session.user;
      const user = await User.findById(userId);
      const today = new Date();
       today.setUTCHours(0, 0, 0, 0);

      const coupons = await Coupon.find({
       isActive: true,
        endDate: { $gte: today },
        $expr: { $lt: ["$usedCount", "$usageLimit"] }
        }).lean();
      res.json({ success: true, coupons });
  
    } catch (err) {
      next(err);
    }
  };
module.exports = {
    getCouponlist,
    addCoupon,
    editCoupon,
    removeCoupon,
    getReferral,
    getUserCoupon,
    getAvailableCoupons,
    generateCouponCode
}