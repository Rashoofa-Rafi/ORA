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
     isDeleted:{
      type:Boolean,
      default:false
     },
     deletedAt:{
      type:Date,
     },
     
     referralCode: {
    type: String,
    unique:true,
    sparse: true,
    
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
usedCoupons: [{
  type: mongoose.Schema.Types.ObjectId,
  ref: 'Coupon'
}]


   },
{ timestamps: true })
  
   





module.exports = mongoose.model("User", userSchema)