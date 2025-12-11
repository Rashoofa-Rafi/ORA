const Product = require('../models/productSchema')
const Category=require('../models/categorySchema')
const Variants=require('../models/varientSchema')
const loadHome=async(req,res)=>{
 try {
    
    // Fetch top categories (Men, Women)
    const categories = await Category.find({
      name: { $in: ['Men', 'Women'] }
    }).select('name image');

    // --- Latest Trends (newly added products) ---
    const latestProductsData = await Product.find({ isListed: true })
      .sort({ createdAt: -1 }) // newest products first
      .limit(4)
      .populate('variants');

    const latestProducts = latestProductsData.map(p => {
      const firstVariant = p.variants?.[0];
      return {
        _id: p._id,
        name: p.productname,
        price: firstVariant?.price ,
        image: firstVariant?.images?.[0] 
      };
    });

    // --- Top Launches (based on most recently added variant) ---
    const topLaunchesData = await Product.find({ isListed: true })
      .populate({
        path: 'variants',
         options: { sort: { createdAt: -1 } } // latest variant first
      })
      .limit(4);

    const topLaunches = topLaunchesData.map(p => {
      const firstVariant = p.variants?.[0];
      return {
        _id: p._id,
        name: p.productname,
        price: firstVariant?.price ,
        image: firstVariant?.images?.[0] 
      }
    })

    return res.render('user/home', {
      categories,
      latestProducts,
      topLaunches,
      query: req.query
    });

  } catch (err) {
    console.error(err);
    return res.status(500).send('Server Error');
  }
};

    


module.exports={loadHome}