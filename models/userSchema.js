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
     walletBalance:{
        type:Number,
        //defualt:0
     },

   },
{ timestamps: true })
  
   





module.exports = mongoose.model("User", userSchema)