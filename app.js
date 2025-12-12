const express=require("express")
const app=express()
const env=require("dotenv").config()
const path=require("path")
const DB =require('./config/db')
const User = require("./models/userSchema")
const userRouter=require('./routes/userRouter')
const adminRouter=require('./routes/adminRouter')
const session=require('express-session')
const passport=require('./config/passport')
DB()



app.use(express.json())
app.use(express.urlencoded({extended:true}))

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false,
    httpOnly:true,
    maxAge:72*60*60*1000  //72hrs
 } 
}));

app.use(passport.initialize())
app.use(passport.session())




app.use(async (req, res, next) => {
  try {
    if (req.session.user) {
      const user = await User.findById(req.session.user).lean();
      res.locals.user = user || null;
    } else {
      res.locals.user = null;
    }
    next();
  } catch (err) {
    console.log("Error setting res.locals.user:", err);
    res.locals.user = null;
    next();
  }
});


app.set("view engine","ejs")
app.set("views",path.join(__dirname,"views"))
app.use(express.static(path.join(__dirname,"public")))




app.use('/admin', (req, res, next) => {
  res.locals.currentPath = req.path;
  next();
});


app.use('/user',userRouter)
app.use('/admin',adminRouter)



app.listen(process.env.PORT,()=>{
    console.log("Server is running");
    
})


module.exports=app