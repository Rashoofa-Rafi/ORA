const Order = require("../models/orderSchema");
const Product = require("../models/productSchema");
const Category = require("../models/categorySchema");
const User = require("../models/userSchema");

const getDashboard = async (req, res, next) => {
  try {
    const { filter = "year", startDate, endDate } = req.query;

    const now = new Date();

let start, end;

if (filter === "today") {
  start = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    0, 0, 0, 0
  ));

  end = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    23, 59, 59, 999
  ));
}

else if (filter === "week") {
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setUTCDate(now.getUTCDate() - 6);

  start = new Date(Date.UTC(
    sevenDaysAgo.getUTCFullYear(),
    sevenDaysAgo.getUTCMonth(),
    sevenDaysAgo.getUTCDate(),
    0, 0, 0, 0
  ));

  end = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    23, 59, 59, 999
  ));
}

else if (filter === "month") {
  start = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    1, 0, 0, 0, 0
  ));

  end = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth() + 1,
    0, 23, 59, 59, 999
  ));
}

else if (filter === "year") {
  start = new Date(Date.UTC(
    now.getUTCFullYear(),
    0, 1, 0, 0, 0, 0
  ));

  end = new Date(Date.UTC(
    now.getUTCFullYear(),
    11, 31, 23, 59, 59, 999
  ));
}

    

    /*BASE PIPELINE */

    const baseMatch = {
      isFinalized: true
    };

    const deliveryMatch = {
      "orderItems.itemStatus": "delivered",
      "orderItems.deliveryDate": { $gte: start, $lte: end }
    };

    /* TOTAL DELIVERED ORDERS */

    const deliveredOrdersAgg = await Order.aggregate([
      { $match: baseMatch },
      { $unwind: "$orderItems" },
      { $match: deliveryMatch },
      { $group: { _id: "$_id" } },
      { $count: "total" }
    ]);

    const totalOrders = deliveredOrdersAgg[0]?.total || 0;

    /* REVENUE  */

    const revenueAgg = await Order.aggregate([
      { $match: baseMatch },
      { $unwind: "$orderItems" },
      { $match: deliveryMatch },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$orderItems.finalItemAmount" }
        }
      }
    ]);

    const netRevenue = revenueAgg[0]?.totalRevenue || 0;

    /* ================= OTHER COUNTS ================= */

    const totalCustomer = await User.countDocuments({ role: "user", isDeleted: false });
    const totalProduct = await Product.countDocuments();

    const pendingAgg = await Order.aggregate([
      { $match: baseMatch },
      { $unwind: "$orderItems" },
      { $match: { "orderItems.itemStatus": { $in: ["confirmed", "shipped"] } } },
      { $count: "total" }
    ]);

    const totalPending = pendingAgg[0]?.total || 0;

    const cancelledAgg = await Order.aggregate([
      { $match: baseMatch },
      { $unwind: "$orderItems" },
      { $match: { "orderItems.itemStatus": "cancelled" } },
      { $count: "total" }
    ]);

    const totalCancelled = cancelledAgg[0]?.total || 0;

    const returnedAgg = await Order.aggregate([
      { $match: baseMatch },
      { $unwind: "$orderItems" },
      { $match: { "orderItems.itemStatus": "returned" } },
      { $count: "total" }
    ]);

    const totalReturned = returnedAgg[0]?.total || 0;

    /*SALES CHART  */

    let groupId;
    let sortStage;
    let labelFormat;

    if (filter === "today") {
      groupId = { hour: { $hour: "$orderItems.deliveryDate" } };
      sortStage = { "_id.hour": 1 };
      labelFormat = d => `${d._id.hour}:00`;
    }

    else if (filter === "year") {
      groupId = { month: { $month: "$orderItems.deliveryDate" } };
      sortStage = { "_id.month": 1 };
      labelFormat = d => `Month ${d._id.month}`;
    }

    else {
      groupId = {
        day: { $dayOfMonth: "$orderItems.deliveryDate" },
        month: { $month: "$orderItems.deliveryDate" }
      };
      sortStage = { "_id.month": 1, "_id.day": 1 };
      labelFormat = d => `${d._id.day}/${d._id.month}`;
    }

    const salesAgg = await Order.aggregate([
      { $match: baseMatch },
      { $unwind: "$orderItems" },
      { $match: deliveryMatch },
      {
        $group: {
          _id: groupId,
          revenue: { $sum: "$orderItems.finalItemAmount" }
        }
      },
      { $sort: sortStage }
    ]);
    
    let salesChartLabels = [];
    let salesChartData = [];
    
   if (filter === "today") {
    
      const hoursRevenue = Array(24).fill(0);
    
      salesAgg.forEach(item => {
        const hourIndex = item._id.hour;
        hoursRevenue[hourIndex] = item.revenue;
      });
    
      salesChartLabels = Array.from({ length: 24 }, (_, i) => `${i}:00`);
      salesChartData = hoursRevenue;
    }
    else if (filter === "year") {
    
      const monthsRevenue = Array(12).fill(0);
    
      salesAgg.forEach(item => {
        const monthIndex = item._id.month - 1;
        monthsRevenue[monthIndex] = item.revenue;
      });
    
      salesChartLabels = [
        "Jan","Feb","Mar","Apr","May","Jun",
        "Jul","Aug","Sep","Oct","Nov","Dec"
      ];
    
      salesChartData = monthsRevenue;
    }
    else {
    
      const daysInMonth = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0
      ).getDate();
    
      const monthRevenue = Array(daysInMonth).fill(0);
    
      salesAgg.forEach(item => {
        const dayIndex = item._id.day - 1;
        monthRevenue[dayIndex] = item.revenue;
      });
    
      salesChartLabels = Array.from(
        { length: daysInMonth },
        (_, i) => `${i + 1}/${now.getMonth() + 1}`
      );
    
      salesChartData = monthRevenue;
    }
    
    /* TOP PRODUCTS */

    const topProductsAgg = await Order.aggregate([
      { $match: baseMatch },
      { $unwind: "$orderItems" },
      { $match: deliveryMatch },
      {
        $group: {
          _id: "$orderItems.productId",
          totalSold: { $sum: "$orderItems.quantity" }
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
      name: p.product.productname,
      totalSold: p.totalSold
    }));

    /* TOP CATEGORIES  */

    const topCategoriesAgg = await Order.aggregate([
      { $match: baseMatch },
      { $unwind: "$orderItems" },
      { $match: deliveryMatch },
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

    /* ================= RENDER ================= */
    console.log("LABELS:", salesChartLabels);
    console.log("DATA:", salesChartData);
    
    res.render("admin/dashboard", {
      report: {
        totalOrders,
        netRevenue,
        totalCustomer,
        totalProduct,
        totalPending,
        totalCancelled,
        totalReturned,
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
