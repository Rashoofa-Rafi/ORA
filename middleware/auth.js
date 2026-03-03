const User = require("../models/userSchema");

// For non-logged-in users to access login/signup pages
const IsUserLoggedOut = async (req, res, next) => {
  try {
    if (req.session.user) {
      const user = await User.findById(req.session.user);

      if (user && user.isBlocked) {
        delete req.session.user;
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
const IsUserAuthenticated = async (req, res, next) => {
  try {
    
    if (!req.session.user) {
      return res.redirect("/user/login");
    }

    const user = await User.findById(req.session.user);

    if (!user) {
      delete req.session.user;
      return res.redirect("/user/signup");
    }

   
    if (user.isBlocked) {
      delete req.session.user;
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
const IsAdminLoggedOut = async (req, res, next) => {
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
const IsAdminAuthenticated = async (req, res, next) => {
  try {
    if (!req.session.admin) {
      return res.redirect("/admin/login");
    }

    const admin = await User.findById(req.session.admin);

    
    if (!admin) {
      delete req.session.admin;
      return res.redirect("/admin/login");
    }

   
    if (admin.role !== "admin") {
      delete req.session.admin;
      return res.redirect("/admin/login");
    }

    

    next();
  } catch (error) {
    console.log( error);
    res.status(500).send("Server Error");
  }
};

module.exports = {
  IsUserLoggedOut,
  IsUserAuthenticated,
  IsAdminLoggedOut,
  IsAdminAuthenticated,
};
