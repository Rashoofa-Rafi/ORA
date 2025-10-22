const express=require('express')
const Admin=require('../models/userSchema.js')
const bcrypt=require('bcrypt')
const { generateOTP, sendVerificationEmail } = require('../helpers/generateotp')

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




const login= async (req,res)=>{
    try {
        const{email,password}=req.body
        const admin=await Admin.findOne({email,role:'admin'})
        if(!admin){
            return res.status(400).json({
                success:false,
                message:'Admin not found'
            })
        }
        const isMatch= await bcrypt.compare(password,admin.password)
        if(!isMatch){
            return res.status(400).json({
                success:false,
                message:'Invalid Password'
            })
        }
        req.session.admin={
            id:admin._id,
            email:admin.email
            
        }
        return res.status(200).json({
            success:true,
            message:'Login successfully',
            redirectUrl:'/admin/dashboard'
        })
    } catch (error) {
        console.error(error)
        return res.status(500).json({
            success:false,
            message:'internal server error'
        })
        
    }
}

const forgetPassword=async(req,res)=>{
    try {
         const { email } = req.body
        const admin = await Admin.findOne({ email,role:'admin' })
        if (!admin) {
            return res.status(400).json({
                success: false,
                message: "Email not registered"
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
        req.session.otp=OTP
        req.session.frgtPasswordemail=email
        return res.status(200).json({
            success:true,
            message:'OTP sent succesfully',
            redirectUrl:'/admin/otp'
        })
        
    } catch (error) {
        console.error(error)
        res.status(500).json({
            success:false,
            message:'internal server error'
        })
    }
}

const verifyOTP=async(req,res)=>{
    try {
        const{OTP}=req.body
        const sessionOTP=req.session.otp
        const sessionData=req.session.frgtPasswordemail
        console.log(sessionOTP)
        console.log(sessionData)

        if(!sessionOTP || !sessionData){
            return res.status(400).json({
                success:false,
                message:'session expired,Please try again'
            })
        }
        if(sessionOTP!==OTP){
            return res.status(400).json({
                success:false,
                message:'Incorrect OTP'
            })
        }
        req.session.verifiedEmail = req.session.frgtPasswordemail

        delete req.session.otp
        delete req.session.frgtPasswordemail
        
        return res.status(200).json({
            success:true,
            message:'OTP verified, you can now change your password',
            redirectUrl:'/admin/change-password'
        })

    } catch (error) {
        console.error(error)
        res.status(500).json({
            success:false,
            message:'internal server error'
        })
        
    }
}

const resendOTP=async(req,res)=>{
    try {
        //const{email}=req.body

        const verifiedEmail=req.session.verifiedEmail 

        if(!verifiedEmail){
            return res.status(400).json({
                success:false,
                message:'session expired,Try again'
            })
        }
        const OTP=generateOTP()
        const emailsent= await sendVerificationEmail(verifiedEmail,OTP)
        if(!emailsent){
            return res.status(400).json({
                success:false,
                message:'sending OTP failed'
            })
        }
        req.session.otp=OTP
        req.session.verifiedEmail=verifiedEmail

        return res.status(200).json({
            success:true,
            message:'OTP again sent successfully',
            redirectUrl:'/admin/otp'
        })

        
    } catch (error) {
        console.error(error)
        res.status(500).json({
            success:false,
            message:'internal server error'
        })
        
    }
}

const changePassword=async(req,res)=>{
    try {
        const{password}=req.body
                const verifiedEmail=req.session.verifiedEmail
                if(!verifiedEmail){
                    return res.status(400).json({
                        success:false,
                        message:'session expires,Please verify OTP again'
                    })
                }
                const admin=await Admin.findOne({email:verifiedEmail,role:'admin'})
                if(!admin){
                    return res.status(400).json({
                        success:false,
                        message:'Admin  not registered'
                    })
                }
                const hashPassword=await bcrypt.hash(password,10)
                admin.password=hashPassword
                await admin.save()

                req.session.destroy()
                return res.status(200).json({
                    success:true,
                    message:'password changed successfully,Please login again',
                    redirectUrl:'/admin/login'
                })
        
        
    } catch (error) {
        console.error(error)
        res.status(500).json({
            success:false,
            message:'internal server error'
        })
        
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