const mongoose = require('mongoose');

const walletTransactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['CREDIT', 'DEBIT'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  reason: {
    type: String,
    required: true
  },
  orderId: {
    type: String
  },
  balanceAfter: {
    type: Number,
    required:false
  }
}, { timestamps: true });

module.exports = mongoose.model('WalletTransaction', walletTransactionSchema);
