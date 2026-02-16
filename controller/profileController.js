const User = require("../models/userSchema");
const bcrypt = require('bcrypt')
const AppError = require("../config/AppError");
const HTTP_STATUS = require("../middleware/statusCode");
const { generateOTP, sendVerificationEmail } = require('../helpers/generateotp')

const getUserProfile = async (req, res, next) => {
  try {
    const userId = req.session.user
     const user = await User.findById(userId).select(
      "fullName email mobile profileImage "
    );

    if (!user) {
      throw new AppError("User not found", HTTP_STATUS.NOT_FOUND);
    }

    res.render("user/profile/profile", {
      user,
      query:req.query
    });

  } catch (err) {
    next(new AppError(err.message ,HTTP_STATUS.INTERNAL_SERVER_ERROR))
  }
}
const uploadProfileImage = async (req, res, next) => {
  try {
    const userId = req.session.user;

    if (!req.file) {
      throw new AppError("No image uploaded", HTTP_STATUS.BAD_REQUEST);
    }

    await User.findByIdAndUpdate(userId, {
      profileImage: req.file.path, // Cloudinary URL
    });

    res.redirect("/user/profile/profile");

  } catch (err) {
    next(new AppError(err.message, HTTP_STATUS.INTERNAL_SERVER_ERROR));
  }
};


 const getEditProfile= async(req,res,next)=>{
    try {
        
        const user = await User.findById(req.session.user)
        if (!user) {
           throw new AppError("User not found", HTTP_STATUS.NOT_FOUND);
        }

        res.render("user/profile/edit-profile", { user,
            query:req.query
         })
    } catch (err) {
         next(new AppError(err.message ,HTTP_STATUS.INTERNAL_SERVER_ERROR))
    }
 }

 const editProfile= async (req,res,next)=>{
    try{
    const {fullName,mobile}=req.body

    if(!fullName ||  !mobile){
        throw new AppError('All field required',HTTP_STATUS.BAD_REQUEST)
    }

    const user = await User.findById(req.session.user)

    if (!user) {
      throw new AppError("User not found", HTTP_STATUS.NOT_FOUND);
    }

    const updateData={fullName,mobile}

    if(req.file){
        updateData.profileImage=req.file.path
    }
    
    await User.findByIdAndUpdate(req.session.user,updateData)

    return res.status(HTTP_STATUS.CREATED).json({
        success:true,
        message:'Profile Updated ',
        redirect:'/user/profile/profile'
    })

    }catch(err){
        next(new AppError(err.message ,HTTP_STATUS.INTERNAL_SERVER_ERROR))
    }
    
 }
 const emailChange =async(req,res,next)=>{
    try {
    const { email } = req.body
    const userId = req.session.user
    if (!userId) {
      throw new AppError("Unauthorized", HTTP_STATUS.UNAUTHORIZED);
    }
    if (!email) {
      throw new AppError("Email is required", HTTP_STATUS.BAD_REQUEST);
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new AppError("User not found", HTTP_STATUS.NOT_FOUND);
    }

    if (email === user.email) {
      throw new AppError("New email is same as current email",HTTP_STATUS.BAD_REQUEST)
        
    }

    const OTP = generateOTP();
    console.log(OTP)
    const emailSent = await sendVerificationEmail(email, OTP);
    if (!emailSent) {
      throw new AppError("Sending OTP failed, try again", HTTP_STATUS.BAD_REQUEST);
    }

    
    req.session.action = "emailChange";
    req.session.pendingEmail = email;
    req.session.emailChangeOTP = OTP;
    req.session.emailChangeOTPExpiresAt = Date.now() + 1 * 60 * 1000; 

    return res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: "OTP sent to your new email. Please verify.",
      redirectUrl: "/user/profile/otp-verify",
    });
        
    } catch (err) {
        next(new AppError(err.message, HTTP_STATUS.INTERNAL_SERVER_ERROR))
    }

 }

 const getchangePassword=async(req,res,next)=>{
    try {
        res.render('user/profile/changepassword')
    } catch (err) {
         next(new AppError(err.message ,HTTP_STATUS.INTERNAL_SERVER_ERROR))
    }
 }
 const getforgetPassword=async(req,res,next)=>{
    try {
        res.render('user/profile/forget-password')
    } catch (err) {
         next(new AppError(err.message ,HTTP_STATUS.INTERNAL_SERVER_ERROR))
    }
 }
 const getNewPassword= async(req,res,next)=>{
    try {
        res.render('user/profile/new-password')
    } catch (err) {
        next(new AppError(err.message ,HTTP_STATUS.INTERNAL_SERVER_ERROR))
    }
 }
 const NewPassword=async (req,res,next)=>{
    try {
        const{password,Cpassword,crntpassword}=req.body
        
        const userId=req.session.user
        if(!userId){
            throw new AppError("Unauthorized", HTTP_STATUS.UNAUTHORIZED)
        }
        if(!password || !Cpassword ||!crntpassword){
            throw new AppError('All field are required',HTTP_STATUS.BAD_REQUEST)
            
        }
        if(password === crntpassword){
            throw new AppError('New password must be different',HTTP_STATUS.BAD_REQUEST)
            
        }
        if(password !== Cpassword){
            throw new AppError('Password doesnot match',HTTP_STATUS.BAD_REQUEST)
            
        }
        const user=await User.findById(req.session.user)
        if(!user){
            throw new AppError('User not found',HTTP_STATUS.BAD_REQUEST)
            
        }
        const hashPassword=await bcrypt.hash(password,10)
        user.password=hashPassword
        await user.save()
        return res.status(HTTP_STATUS.CREATED).json({
            success:true,
            message:'password changed successfully',
            redirectUrl:'/user/profile/profile'
        })

        
    } catch (err) {
        next(new AppError(err.message ,HTTP_STATUS.INTERNAL_SERVER_ERROR))
    }
}
const forgetPassword = async (req, res,next) => {
    try {
        const { email } = req.body
        const user = await User.findOne({ email })
        if (!user) {
            throw new AppError("Email not registered, Please signup",HTTP_STATUS.BAD_REQUEST)
           
        }
        const OTP = generateOTP()
        console.log(OTP)

        const emailsent = await sendVerificationEmail(email, OTP)
        if (!emailsent) {
            throw new AppError( 'sending OTP failed, Try again',HTTP_STATUS.BAD_REQUEST)
            

        }
        req.session.resetotp = OTP
        req.session.resetOtpExpiresAt = Date.now() + 1 * 60 * 1000
        req.session.resetData = { email }
        req.session.action='reset'

        return res.status(HTTP_STATUS.CREATED).json({
            success: true,
            message: 'Reset OTP send ',
            redirectUrl: '/user/profile/otp-verify'
        })
    } catch (err) {
        next(new AppError(err.message ,HTTP_STATUS.INTERNAL_SERVER_ERROR))
    }
}
const getverifyOTP=async(req,res,next)=>{
    try {
        res.render('user/profile/otp-verify')
    } catch (err) {
     next(new AppError(err.message ,HTTP_STATUS.INTERNAL_SERVER_ERROR))
        
    }
}
const verifyOTP = async (req, res,next) => {
    try {
        const { OTP } = req.body
        const action = req.session.action

        const sessionOtp = action === 'reset' ? req.session.resetotp : req.session.emailChangeOTP
        const sessionData = action === 'reset' ? req.session.resetData : req.session.pendingEmail
        
       if (!sessionOtp || !sessionData) {
            throw new AppError("OTP expired..Try again",HTTP_STATUS.BAD_REQUEST)
            
        }
        if (sessionOtp !== OTP) {
            throw new AppError("Incorrect OTP",HTTP_STATUS.BAD_REQUEST)
            
        }
        
        if (action==='reset'){
             req.session.verifiedEmail = sessionData.email
            delete req.session.resetotp
            delete req.session.resetData
            

            return res.status(HTTP_STATUS.CREATED).json({
                success: true,
                message: 'OTP verified,You can change your password',
                redirectUrl: '/user/profile/changepassword'
            })

        }
        if(action==='emailChange'){
            const userId = req.session.user;
            if (!userId) {
            throw new AppError("Unauthorized", HTTP_STATUS.UNAUTHORIZED);
            }

             const user = await User.findById(userId);
            if (!user) {
            throw new AppError("User not found", HTTP_STATUS.NOT_FOUND);
            }
              user.email = sessionData;
              await user.save()
              delete req.session.emailChangeOTP;
              delete req.session.pendingEmail;
     
         return res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: "Email updated successfully",
        redirectUrl: "/user/profile/profile",
      });

        }
           
} catch (err) {
       next(new AppError(err.message ,HTTP_STATUS.INTERNAL_SERVER_ERROR))
    }
}

const resendOtp = async (req, res, next) => {
    try {
        const action = req.session.action
        let email
        let otpExpiresAt
        if (action === 'emailChange' && req.session.pendingEmail) {
                    email = req.session.pendingEmail;
                    otpExpiresAt = req.session.emailChangeOTPExpiresAt
                } else if (action === 'reset' && req.session.resetData) {
                    email = req.session.resetData.email;
                    otpExpiresAt = req.session.resetOtpExpiresAt
                } else {
                    throw new AppError('Session expired. Please signup again.',HTTP_STATUS.BAD_REQUEST)
                    
                }
        
        if (otpExpiresAt && Date.now() < otpExpiresAt) {
            const remaining = Math.ceil((otpExpiresAt - Date.now()) / 1000);
            throw new AppError(`Wait ${remaining}s before requesting another OTP`,HTTP_STATUS.BAD_REQUEST)
            
        }

        const OTP = generateOTP()
        console.log(OTP)
        const emailsent = await sendVerificationEmail(email, OTP)
        if (!emailsent) {
            throw new AppError('Resent OTP failed',HTTP_STATUS.BAD_REQUEST)
            
        }
        if(action==='reset'){
            req.session.resetotp = OTP
            req.session.resetOtpExpiresAt = Date.now() + 1 * 60 * 1000

        }else {
            req.session.emailChangeOTP = OTP
            req.session.emailChangeOTPExpiresAt = Date.now() + 1 * 60 * 1000
        }
        
            
        
        return res.status(HTTP_STATUS.CREATED).json({
            success: true,
            message: "OTP again send successfully",
            redirectUrl: '/user/profile/otp-verify'
        })
    } catch (err) {
       next(new AppError(err.message ,HTTP_STATUS.INTERNAL_SERVER_ERROR))
    }
}
const changePassword=async (req,res,next)=>{
    try {
        const{password}=req.body
        const verifiedEmail=req.session.verifiedEmail
        if(!verifiedEmail){
            throw new AppError('session expires,Please verify OTP again',HTTP_STATUS.BAD_REQUEST)
            
        }
        const user=await User.findOne({email:verifiedEmail})
        if(!user){
            throw new AppError('User not registered,',HTTP_STATUS.BAD_REQUEST)
            
        }
        const hashPassword=await bcrypt.hash(password,10)
        user.password=hashPassword
        await user.save()
        req.session.destroy()
        return res.status(HTTP_STATUS.CREATED).json({
            success:true,
            message:'password changed successfully',
            redirectUrl:'/user/profile/profile'
        })

        
    } catch (err) {
        next(new AppError(err.message ,HTTP_STATUS.INTERNAL_SERVER_ERROR))
    }
}

module.exports = {
  getUserProfile,
  uploadProfileImage,
  getEditProfile,
  editProfile,
  getNewPassword,
  NewPassword,
  getchangePassword,
  getforgetPassword,
  changePassword,
  forgetPassword,
  resendOtp,
  getverifyOTP,
  verifyOTP,
  emailChange
  
};
