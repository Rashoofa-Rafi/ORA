const express=require("express")
const app=express()
const env=require("dotenv").config()
const path=require("path")
const DB =require('./config/db')
const User = require("./models/userSchema")
const Cart = require("./models/cartSchema")
const Wishlist = require("./models/wishlistSchema")
const userRouter=require('./routes/userRouter')
const adminRouter=require('./routes/adminRouter')
const session=require('express-session')
const MongoStore = require('connect-mongo').default;
const passport=require('./config/passport')
const notFound =require('./middleware/notFound')
const errorHandler =require('./middleware/errorHandler')
DB()



app.use(express.json())
app.use(express.urlencoded({extended:true}))

app.use('/user', session({
  name: 'user.sid',  
  secret: process.env.USER_SESSION_SECRET ,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
  cookie: { 
    secure: false,
    httpOnly: true,
    maxAge: 72 * 60 * 60 * 1000 // 72hrs
  }
}));

app.use('/admin', session({
  name: 'admin.sid', 
  secret: process.env.ADMIN_SESSION_SECRET ,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
  cookie: { 
    secure: false,
    httpOnly: true,
    maxAge: 72 * 60 * 60 * 1000 // 72hrs
  }
}));

app.use(passport.initialize())

app.use('/user',async (req, res, next) => {
  try {
    if (req.session.user) {
      const user = await User.findById(req.session.user).lean();
      res.locals.user = user || null;
      const cart = await Cart.findOne({ userId: req.session.user });
      res.locals.cartCount = cart ? cart.totalItem : 0;

      const wishlist = await Wishlist.findOne({ userId: req.session.user });
      res.locals.wishlistCount = wishlist ? wishlist.items.length : 0;

    } else {
      res.locals.user = null;
      res.locals.cartCount = 0;
      res.locals.wishlistCount = 0;
    }
    next();
  } catch (err) {
    console.log("Error setting res.locals.user:", err);
    res.locals.user = null;
    res.locals.cartCount = 0;
    res.locals.wishlistCount = 0;
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

app.use(notFound)
app.use(errorHandler)

app.listen(process.env.PORT,()=>{
    console.log("Server is running");
    
})


module.exports=app