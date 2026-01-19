const mongoose=require("mongoose")


const userSchema=new mongoose.Schema({
    fullName:{
        type:String,
        required: function() { return 
                this.role !== 'admin'}
     },
     email:{
        type:String,
        required:true,
        unique:true
     },
     mobile:{
        type:String,
        required:false,
        unique:true,
        sparse:true,
        default:null
     },
     profileImage:{
      type:String,
      default:''
     },
     password:{
        type:String,
        required:false,
     },
     googleId:{
        type:String,
        required:false
        
      }, role:{
        type:String,
        enum:["user","admin"],
        default:'user'
     },
     isActive:{
        type:Boolean,
        required:false
     },
     isBlocked:{
      type:Boolean,
      required:false
     },
     
     referralCode: {
    type: String,
    unique: true
},
referredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
},
referralRewardApplied: {
    type: Boolean,
    default: false
},
wallet: {
    balance: {
        type: Number,
        default: 0
    },
    transactions: [
        {
            type: {
                type: String, 
            },
            amount: Number,
            reason: String,
            createdAt: {
                type: Date,
                default: Date.now
            }
        }
    ]
},
usedCoupons: [{
  type: mongoose.Schema.Types.ObjectId,
  ref: 'Coupon'
}]


   },
{ timestamps: true })
  
   





module.exports = mongoose.model("User", userSchema)