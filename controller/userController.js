const bcrypt = require('bcrypt')
const User = require('../models/userSchema.js')
const { generateOTP, sendVerificationEmail } = require('../helpers/generateotp')


const loadLogin=async(req,res)=>{
    try {
        res.render('user/login')
    } catch (error) {
       res.status(500).send('server error')
    }
}
const loadOTP=async(req,res)=>{
    try {
        res.render('user/verify-otp')
    } catch (error) {
       res.status(500).send('server error')
        
    }
}



const loadforgetPassword=async(req,res)=>{
    try {
        res.render('user/forget-password')
    } catch (error) {
       res.status(500).send('server error')
        
    }
}

const loadchangePassword=async(req,res)=>{
    try {
        res.render('user/change-password')
    } catch (error) {
       res.status(500).send('server error')
        
    }
}

const loadSignup=async(req,res)=>{
    try {
        res.render('user/signup')
    } catch (error) {
       res.status(500).send('server error')
        
    }
}




const loadpage404=async(req,res)=>{
    try {
        res.render('user/page404')
    } catch (error) {
       res.status(500).send('server error')
        
    }
}


const signup = async (req, res) => {
    try {
        const { fullName, email, mobile, password } = req.body
        
        const existUser = await User.findOne({ email })
        if (existUser)
            return res.status(400).json({
                success: false,
                message: "User already exist"
            })

        //generate OTP for signup

        const OTP = generateOTP()
        console.log(OTP)
        const emailsent = await sendVerificationEmail(email, OTP)

        if (!emailsent) {
            return res.status(400).json({
                success: false,
                message: 'Failed to sent email. Please try again'
            })
        }
        req.session.otp = OTP
        req.session.action = 'signup'
        req.session.userData = { fullName, email, mobile, password }

        return res.status(200).json({
            success: true,
            message: `OTP sent successfully to ${email}`,
            redirectUrl: '/user/verify-otp'
        })

    } catch (error) {
        console.error('SignUp error', error)
        res.status(500).json({
            success: false,
            message: 'internal server error'

        })
    }
}

const forgetPassword = async (req, res) => {
    try {
        const { email } = req.body
        const user = await User.findOne({ email })
        if (!user) {
            return res.status(400).json({
                success: false,
                message: "Email not registered, Please signup"
            })
        }
        const OTP = generateOTP()
        console.log(OTP)

        const emailsent = await sendVerificationEmail(email, OTP)
        if (!emailsent) {
            return res.status(400).json({
                success: false,
                message: 'sending OTP failed, Try again'
            })

        }
        req.session.resetotp = OTP
        req.session.action = 'reset'
        req.session.resetData = { email }
        return res.status(200).json({
            success: true,
            message: 'Reset OTP send ',
            redirectUrl: '/user/verify-otp'
        })
    } catch (error) {
        console.error('resetOTP error', error)
        res.status(500).json({
            success: false,
            message: 'internal server error'
        })

    }
}
const verifyOTP = async (req, res) => {
    try {
        const { OTP } = req.body
        const action = req.session.action

        const sessionOtp = action === 'reset' ? req.session.resetotp : req.session.otp
        const sessionData = action === 'reset' ? req.session.resetData : req.session.userData


        if (!sessionOtp || !sessionData) {
            return res.status(400).json({
                success: false,
                message: "OTP expired..Try again"
            })
        }
        if (sessionOtp !== OTP) {
            return res.status(400).json({
                success: false,
                message: "Incorrect OTP"
            })
        }
        if (action === 'signup') {
            const { fullName, mobile, email, password } = sessionData
            const hashPassword = await bcrypt.hash(password, 10)
            const newUser = new User({
                fullName,
                email,
                mobile,
                password: hashPassword
            })

            await newUser.save()
            console.log(newUser)
            req.session.destroy()
            return res.status(200).json({
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

            return res.status(200).json({
                success: true,
                message: 'OTP verified,You can change your password',
                redirectUrl: '/user/change-password'
            })

        }
        } catch (error) {
        console.error("signup failed,error")
        res.status(500).json({
            success: false,
            message: 'server error'
        })

    }
}

const resendOtp = async (req, res) => {
    try {
        const action = req.session.action

        let email;
        if (action === 'signup' && req.session.userData) {
            email = req.session.userData.email;
        } else if (action === 'reset' && req.session.resetData) {
            email = req.session.resetData.email;
        } else {
            return res.status(400).json({
                success: false,
                message: 'Session expired. Please signup again.'
            });
        }


        const OTP = generateOTP()
        console.log(OTP)
        const emailsent = await sendVerificationEmail(email, OTP)
        if (!emailsent) {
            return res.status(400).json({
                success: false,
                message: 'Resent OTP failed'
            })
        }
        if (action === 'signup') {
            req.session.otp = OTP
        } else {
            req.session.resetotp = OTP
        }
        return res.status(200).json({
            success: true,
            message: "OTP again send successfully",
            redirectUrl: '/user/verify-otp'
        })
    } catch (error) {
        console.error(error)
        res.status(500).json({
            success: false,
            message: 'internal server error'
        })

    }
}

const changePassword=async (req,res)=>{
    try {
        const{password}=req.body
        const verifiedEmail=req.session.verifiedEmail
        if(!verifiedEmail){
            return res.status(400).json({
                success:false,
                message:'session expires,Please verify OTP again'
            })
        }
        const user=await User.findOne({email:verifiedEmail})
        if(!user){
            return res.status(400).json({
                success:false,
                message:'User not registered,Please signup'
            })
        }
        const hashPassword=await bcrypt.hash(password,10)
        user.password=hashPassword
        await user.save()
        req.session.destroy()
        return res.status(200).json({
            success:true,
            message:'password changed successfully,Please login again',
            redirectUrl:'/user/login'
        })

        
    } catch (error) {
        console.error('error in password change')
        res.status(500).json({
            success:false,
            message:'internal server error'
        })
    }
}

const login = async (req, res) => {
    try {
        const { email, password } = req.body
        console.log(req.body)
        const user = await User.findOne({ email })
        if (!user) {
            return res.status(400).json({
                success: false,
                message: "User not found"
            })
        }
        if (!user.password) {
            return res.status(400).json({ 
                success: false,
                message: "Please login with Google" 
            });
        }
        const isMatch = await bcrypt.compare(password, user.password)
       
        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: "Incorrect Password"
            })
        }
        req.session.user = user._id.toString()
        
        

        return res.status(200).json({
            success: true,
            message: "Login successfully",
            redirectUrl: '/user/home'
        })
    } catch (error) {
        console.log('login failed')
        res.status(500).json({
            success: false,
            message: "internal Server error"
        })
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