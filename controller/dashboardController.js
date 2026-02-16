const Order = require("../models/orderSchema")
const Product = require("../models/productSchema")
const Category = require("../models/categorySchema")
const User = require("../models/userSchema");

const getDashboard = async (req, res, next) => {
  try {
    const { filter = "year", startDate, endDate } = req.query;

    let dateFilter = {};
    const now = new Date();

    if (filter === "today") {
      const start = new Date();
      start.setHours(0,0,0,0);
      const end = new Date();
      end.setHours(23,59,59,999);
      dateFilter = { createdAt: { $gte: start, $lte: end } };
    }

    if (filter === "week") {
      const start = new Date();
      start.setDate(now.getDate() - 7);
      dateFilter = { createdAt: { $gte: start, $lte: now } };
    }

    if (filter === "month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth()+1, 0, 23,59,59);
      dateFilter = { createdAt: { $gte: start, $lte: end } };
    }

    if (filter === "year") {
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear(), 11, 31, 23,59,59);
      dateFilter = { createdAt: { $gte: start, $lte: end } };
    }

    if (filter === "custom" && startDate && endDate) {
  dateFilter = {
    createdAt: {
      $gte: new Date(startDate),
      $lte: new Date(new Date(endDate).setHours(23,59,59,999))
    }
  };
}

    /*  SUMMARY CARDS */
const matchCondition = {
      ...dateFilter,
      isFinalized: true
    };
    

    const deliveredOrdersCount = await Order.aggregate([
  { $match: matchCondition },
  { $unwind: "$orderItems" },
  { $match: { "orderItems.itemStatus": "delivered" } },
  {
    $group: { 
      _id: "$_id"
    }
  },
  { $count: "total" }
]);
const totalOrders =deliveredOrdersCount[0]?.total|| 0 

    const deliveredRevenueAgg = await Order.aggregate([
  { $match: matchCondition },
  { $unwind: "$orderItems" },
  { $match: { "orderItems.itemStatus": "delivered" } },
  {
    $group: {
      _id: null,
      totalRevenue: { $sum: "$orderItems.finalItemAmount" },
      
    }
  }
]);

const netRevenue = deliveredRevenueAgg[0]?.totalRevenue || 0;

    const totalCustomer = await User.countDocuments({ role: "user",isDeleted:false });
    const totalProduct = await Product.countDocuments();

    const pendingItemsAgg = await Order.aggregate([
  { $match: matchCondition },
  { $unwind: "$orderItems" },
  { $match: { "orderItems.itemStatus": "confirmed" ||"shipped" } },
  { $count: "total" }
])
const totalPending = pendingItemsAgg[0]?.total ||0

const cancelledItemsAgg = await Order.aggregate([
  { $match: matchCondition },
  { $unwind: "$orderItems" },
  { $match: { "orderItems.itemStatus": "cancelled" } },
  { $count: "total" }
]);

const totalCancelled = cancelledItemsAgg[0]?.total || 0;


   

   /* ================= DYNAMIC SALES CHART ================= */

let groupStage;
let labelFormat;

if (filter === "today") {
  // Group by hour
  groupStage = {
    _id: { hour: { $hour: "$createdAt" } },
    revenue: { $sum: "$finalAmount" }
  };
  labelFormat = (d) => `${d._id.hour}:00`;
}

else if (filter === "week" || filter === "month" || filter === "custom") {
  // Group by day
  groupStage = {
    _id: {
      day: { $dayOfMonth: "$createdAt" },
      month: { $month: "$createdAt" }
    },
    revenue: { $sum: "$finalAmount" }
  };
  labelFormat = (d) => `${d._id.day}/${d._id.month}`;
}

else {
  // Year → group by month
  groupStage = {
    _id: { month: { $month: "$createdAt" } },
    revenue: { $sum: "$finalAmount" }
  };
  labelFormat = (d) => `Month ${d._id.month}`;
}

const salesDataAgg = await Order.aggregate([
  { $match: matchCondition },
  { $unwind: "$orderItems" },
  { $match: { "orderItems.itemStatus": "delivered" } },
  {
    $group: groupStage = {
      _id: filter === "today"
        ? { hour: { $hour: "$createdAt" } }
        : filter === "year"
        ? { month: { $month: "$createdAt" } }
        : {
            day: { $dayOfMonth: "$createdAt" },
            month: { $month: "$createdAt" }
          },
      revenue: { $sum: "$orderItems.finalItemAmount" }
    }
  },
  { $sort: { "_id": 1 } }
]);


const salesChartLabels = salesDataAgg.map(labelFormat);
const salesChartData = salesDataAgg.map(d => d.revenue);


    /*TOP PRODUCTS */

    const topProductsAgg = await Order.aggregate([
  { $match: matchCondition },
  { $unwind: "$orderItems" },
  { $match: { "orderItems.itemStatus": "delivered" } },
  {
    $group: {
      _id: "$orderItems.productId",
      totalSold: { $sum: "$orderItems.quantity" },
      revenue: { $sum: "$orderItems.finalItemAmount" }
    }
  },
  { $sort: { totalSold: -1 } },
  { $limit: 10 },
  {
    $lookup: {
      from: "products",
      localField: "_id",
      foreignField: "_id",
      as: "product"
    }
  },
  { $unwind: "$product" }
]);


    const topProducts = topProductsAgg.map(p => ({
      name: p.product.productname ,
      totalSold: p.totalSold
    }));

    /*TOP CATEGORIES */

  const topCategoriesAgg = await Order.aggregate([
  { $match: matchCondition},
  { $unwind: "$orderItems" },
  { $match: { "orderItems.itemStatus": "delivered" } },
  {
    $lookup: {
      from: "products",
      localField: "orderItems.productId",
      foreignField: "_id",
      as: "product"
    }
  },
  { $unwind: "$product" },
  {
    $group: {
      _id: "$product.category_Id",
      totalSold: { $sum: "$orderItems.quantity" }
    }
  },
  { $sort: { totalSold: -1 } },
  { $limit: 10 },
  {
    $lookup: {
      from: "categories",
      localField: "_id",
      foreignField: "_id",
      as: "category"
    }
  },
  { $unwind: "$category" }
]);


    const topCategories = topCategoriesAgg.map(c => ({
      name: c.category.name,
      totalSold: c.totalSold
    }));

  res.render("admin/dashboard", {
      report: {
        totalOrders,
        netRevenue,
        totalCustomer,
        totalProduct,
        totalPending,
        totalCancelled,
        salesChartLabels,
        salesChartData,
        topProducts,
        topCategories
      },
      query: req.query
    });

  } catch (error) {
    next(error);
  }
};

module.exports = { getDashboard };
