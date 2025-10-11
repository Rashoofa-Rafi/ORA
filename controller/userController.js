const bcrypt=require('bcrypt')
 const User=require('../models/userSchema')
 


const signup= async(req,res)=>{
    try{
        const {fullName,email,mobile,password}=req.body
        console.log(req.body)
        const existUser=await User.findOne({email})
        if(existUser)
            return res.status(400).json({
        success:false,
        message:"User already exist"
       })
       const hashPassword=await bcrypt.hash(password,10)
       const newUser=new User({
        fullName,
        email,
        mobile,
        password:hashPassword
       })

        await newUser.save()
        console.log(newUser)
        return res.status(200).json({
            success:true,
            message:'User registered successfully!',
            redirectUrl:'/user/OTP'
        })
    }catch(error){
        console.error('SignUp error',error)
        res.status(500).json({
            success:false,
            message:'internal server error'

        })
    }
}

const login= async(req,res)=>{
    try{
        const {email,password}=req.body
        console.log(req.body)
        const user=await User.findOne({email})
        if(!user){
            return res.status(400).json({
                success:false,
                message:"User not found"
            })
        }
        const isMatch=await bcrypt.compare(password,user.password)
        console.log(isMatch)
        if(!isMatch){
            return res.status(400).json({
                success:false,
                message:"Incorrect Password"
            })
        }
        req.session.user={
            id:user._id,
            email:user.email
        }
        
            return res.status(200).json({
                success:true,
                message:"Login successfully",
                redirectUrl:'/user/landingHome'
            })
        }catch(error){
        console.log('login failed')
        res.status(500).json({
            success:false,
            message:"internal Server error"
        })
    }
}




module.exports={
    signup,
    login
  
}