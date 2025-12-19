const User= require('../models/userSchema')
const Address=require('../models/addressSchema')
const AppError = require("../config/AppError")
const HTTP_STATUS = require("../middleware/statusCode")

const getUserAddress=async(req,res,next)=>{
    try {
    const userId = req.session.user;
    
    const user = await User.findById(userId).select('fullName');
    if (!user) {
      throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
    }
   
    const addresses = await Address.find({ user_Id: userId }).sort({ isDefault: -1, createdAt: -1 })
        res.render('user/profile/address',{
            addresses,
            query:req.query
        })
    } catch (err) {
        next(new AppError(err.message ,HTTP_STATUS.INTERNAL_SERVER_ERROR))
    }
}
const getSingleAddress = async (req, res, next) => {
  try {
    const userId = req.session.user;
    const addressId = req.params.id;

    if (!userId) {
      return next(new AppError("Unauthorized", HTTP_STATUS.UNAUTHORIZED));
    }

    const address = await Address.findOne({ _id: addressId, user_Id: userId });
    if (!address) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: "Address not found for this user"
      });
    }

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      address
    });
  } catch (err) {
    next(new AppError(err.message, HTTP_STATUS.INTERNAL_SERVER_ERROR));
  }
}

const addUserAddress= async(req,res,next)=>{
    try {
        const userId = req.session.user;
    if (!userId) {
      throw new AppError("Unauthorized", HTTP_STATUS.UNAUTHORIZED);
    }

    const {
      name,
      addressLine,
      city,
      locality,
      state,
      pinCode,
      phone,
      altPhone,
      addressType,
      isDefault
    } = req.body;

    if (!name || !phone || !addressLine || !city || !state || !pinCode ||!locality ||! altPhone) {
      throw new AppError("All fields are required", HTTP_STATUS.BAD_REQUEST);
    }

    // If this should be default, unset existing default for this user
    if (isDefault) {
      await Address.updateMany(
        { user: userId },
        { $set: { isDefault: false } }
      );
    }

    const newAddress = new Address({
      user_Id: userId,
      name,
      addressLine,
      city,
      state,
      pinCode,
      phone,
      altPhone,
      addressType,
      isDefault: !!isDefault
    });

    await newAddress.save();

    return res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: "Address added successfully",
      redirect:'/user/profile/address'
    });
        
    } catch (err) {
        next(new AppError(err.message ,HTTP_STATUS.INTERNAL_SERVER_ERROR))
    }
}

const editUserAddress=async(req,res,next)=>{
    try {
    const addressId = req.params.id;
    const userId = req.session.user;

    if (!addressId) {
      throw new AppError("Address not found", HTTP_STATUS.BAD_REQUEST);
    }

    const {
      name,
      phone,
      addressLine,
      city,
      state,
      locality,
      pinCode,
      altPhone,
      addressType,
      isDefault,
    } = req.body;

    // Find address that belongs to this user
    const address = await Address.findOne({ _id: addressId, user_Id: userId });
    if (!address) {
      throw new AppError("Address not found for this User", HTTP_STATUS.NOT_FOUND);
    }

    // Update fields
    address.name = name;
    address.addressLine = addressLine;
    address.city = city;
    address.locality = locality;
    address.state = state;
    address.pinCode = pinCode;
    address.phone = phone;
    address.altPhone = altPhone;
    address.addressType = addressType || "Home";

    // Handle default flag
    if (isDefault) {
      await Address.updateMany(
        { user: userId, _id: { $ne: addressId } },
        { $set: { isDefault: false } }
      );
      address.isDefault = true;
    }

    await address.save()

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: "Address updated successfully",
      redirect:'/user/profile/address'
    })
    } catch (err) {
        next(new AppError(err.message ,HTTP_STATUS.INTERNAL_SERVER_ERROR))
    }
}
const deleteUserAddress= async(req,res,next)=>{
    try {
    const addressId = req.params.id;
    const userId = req.session.user;

    if (!addressId) {
      throw new AppError("Address not found", HTTP_STATUS.BAD_REQUEST);
    }

    const address = await Address.findOneAndDelete({_id: addressId,user_Id: userId,})
      
    if (!address) {
      throw new AppError("Address not found", HTTP_STATUS.NOT_FOUND);
    }

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: "Address deleted successfully",
    })
        
    } catch (err) {
       next(new AppError(err.message ,HTTP_STATUS.INTERNAL_SERVER_ERROR)) 
    }
}
const setDefaultAddress = async (req, res, next) => {
  try {
    const userId = req.session.user;
    const addressId = req.params.id;

    if (!userId) {
      return next(new AppError("Unauthorized", HTTP_STATUS.UNAUTHORIZED));
    }

    if (!addressId) {
      return next(new AppError("Address ID is required", HTTP_STATUS.BAD_REQUEST));
    }

    const address = await Address.findOne({ _id: addressId, user_Id: userId });
    if (!address) {
      return next(new AppError("Address not found for this user", HTTP_STATUS.NOT_FOUND));
    }

    await Address.updateMany(
      { user_Id: userId, _id: { $ne: addressId } },
      { $set: { isDefault: false } }
    );

  // Set this address to isDefault = true
    address.isDefault = true;
    await address.save();

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: "Default address updated successfully"
    });
  } catch (err) {
    next(new AppError(err.message, HTTP_STATUS.INTERNAL_SERVER_ERROR));
  }
};
module.exports={
    getUserAddress,
    getSingleAddress,
    addUserAddress,
    editUserAddress,
    deleteUserAddress,
    setDefaultAddress

}