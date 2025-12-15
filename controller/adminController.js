const express=require('express')
const Admin=require('../models/userSchema.js')
const bcrypt=require('bcrypt')
const { generateOTP, sendVerificationEmail } = require('../helpers/generateotp')
const HTTP_STATUS=require('../middleware/statusCode')
const AppError=require('../config/AppError')

const loadLogin=async(req,res)=>{
    try {
        res.render('admin/login')
    } catch (error) {
        res.status(500).send('server error')
    }
}

const loadDashboard=async(req,res)=>{
    try {
        res.render('admin/dashboard')
    } catch (error) {
        res.status(500).send('server error')
    }
}

const loadOTP=async(req,res)=>{
    try {
        res.render('admin/otp')
    } catch (error) {
        res.status(500).send('server error')
    }
}

const loadchangePassword=async(req,res)=>{
    try {
        res.render('admin/change-password')
    } catch (error) {
        res.status(500).send('server error')
    }
}
const loadforgetPassword=async(req,res)=>{
    try {
        res.render('admin/forget-password')
    } catch (error) {
        res.status(500).send('server error')
    }
}




const login= async (req,res,next)=>{
    try {
        const{email,password}=req.body
        const admin=await Admin.findOne({email,role:'admin'})
        if(!admin){
           throw new AppError('Admin not found'.HTTP_STATUS.BAD_REQUEST)
        }
        const isMatch= await bcrypt.compare(password,admin.password)
        if(!isMatch){
            throw new AppError('Password do not match'.HTTP_STATUS.BAD_REQUEST)
        }
        req.session.admin=admin._id.toString()
            
            
        return res.status(HTTP_STATUS.CREATED).json({
            success:true,
            message:'Login successfully',
            redirectUrl:'/admin/dashboard'
        })
    } catch (err) {
        next(new AppError(err.message ,HTTP_STATUS.INTERNAL_SERVER_ERROR))
    }
}

const forgetPassword=async(req,res,next)=>{
    try {
         const { email } = req.body
        const admin = await Admin.findOne({ email,role:'admin' })
        if (!admin) {
            throw new AppError("Email not registered",HTTP_STATUS.BAD_REQUEST)
           
        }
        const OTP = generateOTP()
        console.log(OTP)
        const emailsent = await sendVerificationEmail(email, OTP)
        if (!emailsent) {
            throw new AppError('sending OTP failed, Try again',HTTP_STATUS.BAD_REQUEST)
            
        }
        req.session.otp=OTP
        req.session.frgtPasswordemail=email
        return res.status(HTTP_STATUS.CREATED).json({
            success:true,
            message:'OTP sent succesfully',
            redirectUrl:'/admin/otp'
        })
        
    } catch (err) {
        next(new AppError(err.message ,HTTP_STATUS.INTERNAL_SERVER_ERROR))
    }
}

const verifyOTP=async(req,res,next)=>{
    try {
        const{OTP}=req.body
        const sessionOTP=req.session.otp
        const sessionData=req.session.frgtPasswordemail
        console.log(sessionOTP)
        console.log(sessionData)

        if(!sessionOTP || !sessionData){
            throw new AppError('session expired,Please try again',HTTP_STATUS.BAD_REQUEST)
            
        }
        if(sessionOTP!==OTP){
             throw new AppError('Incorrect OTP',HTTP_STATUS.BAD_REQUEST)
           
        }
        req.session.verifiedEmail = req.session.frgtPasswordemail

        delete req.session.otp
        delete req.session.frgtPasswordemail
        
        return res.status(HTTP_STATUS.CREATED).json({
            success:true,
            message:'OTP verified, you can now change your password',
            redirectUrl:'/admin/change-password'
        })

    } catch (err) {
        next(new AppError(err.message ,HTTP_STATUS.INTERNAL_SERVER_ERROR))
    }
}

const resendOTP=async(req,res,next)=>{
    try {
        
       const email = req.session.frgtPasswordemail 
       if(!email){
        throw new AppError('session expired,Try again',HTTP_STATUS.BAD_REQUEST)
            
        }
        const OTP=generateOTP()
        console.log(OTP)
        const emailsent= await sendVerificationEmail(email,OTP)
        if(!emailsent){
             throw new AppError('sending OTP failed',HTTP_STATUS.BAD_REQUEST)
        }
        req.session.otp=OTP
        
        return res.status(HTTP_STATUS.CREATED).json({
            success:true,
            message:'OTP again sent successfully',
            redirectUrl:'/admin/otp'
        })

        
    } catch (err) {
        next(new AppError(err.message ,HTTP_STATUS.INTERNAL_SERVER_ERROR))
    }
}

const changePassword=async(req,res,next)=>{
    try {
        const{password}=req.body
                const verifiedEmail=req.session.verifiedEmail
                if(!verifiedEmail){
                    throw new AppError('session expires,Please verify OTP again',HTTP_STATUS.BAD_REQUEST)
                }
                const admin=await Admin.findOne({email:verifiedEmail,role:'admin'})
                if(!admin){
                    throw new AppError('Admin not Found',HTTP_STATUS.BAD_REQUEST)
                }
                const hashPassword=await bcrypt.hash(password,10)
                admin.password=hashPassword
                await admin.save()

                req.session.destroy()
                return res.status(HTTP_STATUS.CREATED).json({
                    success:true,
                    message:'password changed successfully,Please login again',
                    redirectUrl:'/admin/login'
                })
        
    } catch (err) {
       next(new AppError(err.message ,HTTP_STATUS.INTERNAL_SERVER_ERROR))
    }
}


module.exports={
    loadLogin,
    loadOTP,
    loadDashboard,
    loadchangePassword,
    loadforgetPassword,
    login,
    forgetPassword,
    verifyOTP,
    resendOTP,
    changePassword}