const bcrypt = require('bcrypt')
const User = require('../models/userSchema.js')
const HTTP_STATUS = require('../middleware/statusCode.js');
const AppError=require('../config/AppError')
const { generateOTP, sendVerificationEmail } = require('../helpers/generateotp')
const {generateReferralCode} =require('../helpers/generateReferralCode.js')


const loadLogin=async(req,res,next)=>{
    try {
        res.render('user/login')
    } catch (err) {
      next(err)
    }
}
const loadOTP=async(req,res,next)=>{
    try {
        res.render('user/verify-otp')
    } catch (err) {
      next(err)
        
    }
}



const loadforgetPassword=async(req,res,next)=>{
    try {
        res.render('user/forget-password')
    } catch (err) {
       next(err)
        
    }
}

const loadchangePassword=async(req,res,next)=>{
    try {
        res.render('user/change-password')
    } catch (err) {
       next(err)
        
    }
}

const loadSignup=async(req,res,next)=>{
    try {
        res.render('user/signup')
    } catch (err) {
     next(err)
        
    }
}




const loadpage404=async(req,res)=>{
    try {
        res.render('user/page404')
    } catch (error) {
       res.status(500).send('server error')
        
    }
}


const signup = async (req, res,next) => {
    try {
        const { fullName, email, mobile, password,referralCode } = req.body
        
        const existUser = await User.findOne({ email })
        if (existUser){
            throw new AppError("User already exist",HTTP_STATUS.BAD_REQUEST)
        }
         let referredBy = null;
         if (referralCode) {
            const referrer = await User.findOne({ referralCode });

            if (!referrer) {
                throw new AppError("Invalid referral code", HTTP_STATUS.BAD_REQUEST);
            }
          referredBy = referrer._id;
        }
          
        //generate OTP for signup

        const OTP = generateOTP()
        console.log(OTP)
        const emailsent = await sendVerificationEmail(email, OTP)

        if (!emailsent) {
            throw new AppError('Failed to sent email. Please try again',HTTP_STATUS.BAD_REQUEST)
           
        }
        req.session.otp = OTP
        req.session.otpExpiresAt = Date.now() + 1 * 60 * 1000
        req.session.action = 'signup'
        req.session.userData = { fullName, email, mobile, password,referredBy }

        return res.status(HTTP_STATUS.CREATED).json({
            success: true,
            message: `OTP sent successfully to ${email}`,
            redirectUrl: '/user/verify-otp'
        })

    } catch (err) {
       next(err)
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
        req.session.resetotpExpiresAt = Date.now() + 1 * 60 * 1000
        req.session.action = 'reset'
        req.session.resetData = { email }
        return res.status(HTTP_STATUS.CREATED).json({
            success: true,
            message: 'Reset OTP send ',
            redirectUrl: '/user/verify-otp'
        })
    } catch (err) {
        next(new AppError(err.message ,HTTP_STATUS.INTERNAL_SERVER_ERROR))
    }
}
const verifyOTP = async (req, res,next) => {
    try {
        const { OTP } = req.body
        const action = req.session.action

        const sessionOtp = action === 'reset' ? req.session.resetotp : req.session.otp
        const sessionData = action === 'reset' ? req.session.resetData : req.session.userData


        if (!sessionOtp || !sessionData) {
            throw new AppError("OTP expired..Try again",HTTP_STATUS.BAD_REQUEST)
            
        }
        if (sessionOtp !== OTP) {
            throw new AppError("Incorrect OTP",HTTP_STATUS.BAD_REQUEST)
            
        }
        if (action === 'signup') {
            const { fullName, mobile, email, password,referredBy } = sessionData
            const hashPassword = await bcrypt.hash(password, 10)
            const newUser = new User({
                fullName,
                email,
                mobile,
                password: hashPassword,
                referralCode: generateReferralCode(),
    referredBy :sessionData.referredBy
            })

            await newUser.save()
            console.log(newUser)
            req.session.destroy()
            return res.status(HTTP_STATUS.CREATED).json({
                success: true,
                message: 'User registered successfully!',
                redirectUrl: '/user/login'
            })
        }
        if (action === 'reset') {
            req.session.verifiedEmail = sessionData.email
            delete req.session.resetotp
            delete req.session.resetData
            delete req.session.action

            return res.status(HTTP_STATUS.CREATED).json({
                success: true,
                message: 'OTP verified,You can change your password',
                redirectUrl: '/user/change-password'
            })

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
        if (action === 'signup' && req.session.userData) {
            email = req.session.userData.email;
            otpExpiresAt = req.session.otpExpiresAt
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
        if (action === 'signup') {
            req.session.otp = OTP
            req.session.otpExpiresAt = Date.now() + 1 * 60 * 1000
        } else {
            req.session.resetotp = OTP
            req.session.resetOtpExpiresAt = Date.now() + 1 * 60 * 1000
        }
        return res.status(HTTP_STATUS.CREATED).json({
            success: true,
            message: "OTP again send successfully",
            redirectUrl: '/user/verify-otp'
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
            throw new AppError('User not registered,Please signup',HTTP_STATUS.BAD_REQUEST)
            
        }
        const hashPassword=await bcrypt.hash(password,10)
        user.password=hashPassword
        await user.save()
        req.session.destroy()
        return res.status(HTTP_STATUS.CREATED).json({
            success:true,
            message:'password changed successfully,Please login again',
            redirectUrl:'/user/login'
        })

        
    } catch (err) {
        next(new AppError(err.message ,HTTP_STATUS.INTERNAL_SERVER_ERROR))
    }
}

const login = async (req, res,next) => {
    try {
        const { email, password } = req.body
        console.log(req.body)
        const user = await User.findOne({ email })
        if (!user) {
            throw new AppError("User not found",HTTP_STATUS.BAD_REQUEST)
            
        }
        if (!user.password) {
            throw new AppError("Please login with Google",HTTP_STATUS.BAD_REQUEST)
            
        }
        const isMatch = await bcrypt.compare(password, user.password)
       
        if (!isMatch) {
            throw new AppError("Incorrect Password",HTTP_STATUS.BAD_REQUEST)
            
        }
        req.session.user = user._id.toString()
        
        

        return res.status(HTTP_STATUS.CREATED).json({
            success: true,
            message: "Login successfully",
            redirectUrl: '/user/home'
        })
    } catch (err) {
       next(new AppError(err.message ,HTTP_STATUS.INTERNAL_SERVER_ERROR))
    }
}


module.exports = {
    loadLogin,
    loadOTP,
    loadforgetPassword,
    loadchangePassword,
    loadpage404,
    loadSignup,
    signup,
    forgetPassword,
    verifyOTP,
    resendOtp,
    changePassword,
    login,
    

}