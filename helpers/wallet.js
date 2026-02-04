const Wallet = require('../models/walletSchema')
const WalletTransaction = require('../models/walletTransactionSchema')
const AppError = require('../config/AppError')
const HTTP_STATUS = require('../middleware/statusCode')


async function creditWallet({orderId,reason,amount,userId}){
    console.log(orderId,userId,amount,reason)
    if(!userId){
            throw new AppError('please login',HTTP_STATUS.UNAUTHORIZED)
        }
        const amt = Number(amount);
        if (isNaN(amt) || amt <= 0){
             throw new AppError('Invalid amount', HTTP_STATUS.BAD_REQUEST)
        };
        let wallet = await Wallet.findOne({ userId });
    if (!wallet) wallet = await Wallet.create({ userId, balance: 0 });

    wallet.balance += amt;
    await wallet.save();

    await WalletTransaction.create({
        userId,
        type: 'CREDIT',
        amount:amt,
        reason,
        orderId,
        balanceAfter: wallet.balance
    });
    return wallet.balance
}
    

async function debitWallet({userId,orderId,amount,reason}){
    if(!userId){
            throw new AppError('please login',HTTP_STATUS.UNAUTHORIZED)
        }
        const amt = Number(amount);
        if (isNaN(amt) || amt <= 0){
             throw new AppError('Invalid amount', HTTP_STATUS.BAD_REQUEST)
        };
        const wallet = await Wallet.findOne({ userId });
    if (!wallet || wallet.balance < amt) {
        throw new AppError('Insufficient wallet balance',HTTP_STATUS.BAD_REQUEST);
    }

    wallet.balance -= amt;
    await wallet.save();

    await WalletTransaction.create({
        userId,
        type: 'DEBIT',
        amount:amt,
        reason,
        orderId,
        balanceAfter: wallet.balance
    });
    return wallet.balance
}

module.exports={
    creditWallet,
    debitWallet
}