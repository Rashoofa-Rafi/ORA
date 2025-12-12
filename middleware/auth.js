const User = require("../models/userSchema");

// For non-logged-in users to access login/signup pages
const userIsLoggedOut = async (req, res, next) => {
  try {
    if (req.session.user) {
      const user = await User.findById(req.session.user);

      if (user && user.isBlocked) {
        req.session.destroy();
        return res.render("user/login", {
          message: "Your account has been blocked by admin.",
        });
      }

      return res.redirect("/user/home");
    }

    next();
  } catch (error) {
    console.log( error);
    res.status(500).json({success:false,
      message:"Server Error"});
  }
};

// Protect all user-only pages
const userIsAuthenticated = async (req, res, next) => {
  try {
    
    if (!req.session.user) {
      return res.redirect("/user/login");
    }

    const user = await User.findById(req.session.user);

    if (!user) {
      req.session.destroy();
      return res.redirect("/user/signup");
    }

   
    if (user.isBlocked) {
      req.session.destroy();
      return res.render("user/login", {
        message: "Your account has been blocked by admin.",
      });
    }

    // Attach user to res.locals for EJS access
    res.locals.user = user;


    next();
  } catch (error) {
    console.log("Error in userIsAuthenticated middleware:", error);
    res.status(500).send("Server Error");
  }
};



// Prevent logged-in admin from accessing login page again
const adminIsLoggedOut = async (req, res, next) => {
  try {
    if (req.session.admin) {
      return res.redirect("/admin/dashboard");
    }
    next();
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
};

// Protect all admin routes
const adminIsAuthenticated = async (req, res, next) => {
  try {
    if (!req.session.admin) {
      return res.redirect("/admin/login");
    }

    const admin = await User.findById(req.session.admin);

    
    if (!admin) {
      req.session.destroy();
      return res.redirect("/admin/login");
    }

   
    if (admin.role !== "admin") {
      req.session.destroy();
      return res.redirect("/admin/login");
    }

    

    next();
  } catch (error) {
    console.log( error);
    res.status(500).send("Server Error");
  }
};

module.exports = {
  userIsLoggedOut,
  userIsAuthenticated,
  adminIsLoggedOut,
  adminIsAuthenticated,
};
