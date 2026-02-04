const Wallet=require('../models/walletSchema')
const WalletTransaction=require('../models/walletTransactionSchema')
const User=require('../models/userSchema')
const AppError = require('../config/AppError')
const HTTP_STATUS = require('../middleware/statusCode')



const getWallet=async(req,res,next)=>{
    try {
        const page=parseInt(req.query.page) || 1
        const limit=4
        const userId=req.session.user
        if(!userId){
            throw new AppError('Please login',HTTP_STATUS.UNAUTHORIZED)
        }
        const user = await User.findById(userId).select('fullName');
        
        let wallet=await Wallet.findOne({userId})
        if(!wallet){
           wallet = await Wallet.create({ userId });
        }
        const transactions=await WalletTransaction.find({userId})
        .sort({createdAt:-1})
        .skip((page-1)*limit)
        .limit(limit)

        const totalDocument=await WalletTransaction.countDocuments(userId)
        const totalPages=Math.ceil(totalDocument/limit)

        res.render('user/profile/wallet',{
            wallet,
            transactions,
            totalPages,
            page,
            query:req.query
        })
        
    } catch (err) {
        next(err)
    }
}




module.exports={
    getWallet,
    
    
}