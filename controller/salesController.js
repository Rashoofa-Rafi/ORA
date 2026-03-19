const Order = require("../models/orderSchema");
const mongoose = require("mongoose");
const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs")
const AppError = require('../config/AppError')


const getSalesReport = async (req, res, next) => {
  try {
    const { filter = "year", startDate, endDate, page = 1 } = req.query;

    const limit = 10;
    const skip = (page - 1) * limit;
    const now = new Date();

    let dateFilter = {};

    // DATE FILTER 
    if (filter === "today") {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      dateFilter.createdAt = { $gte: start };
    }

    if (filter === "week") {
      const start = new Date();
      start.setDate(start.getDate() - 7);
      dateFilter.createdAt = { $gte: start };
    }

    if (filter === "month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFilter.createdAt = { $gte: start };
    }

    if (filter === "year") {
      const start = new Date(now.getFullYear(), 0, 1);
      dateFilter.createdAt = { $gte: start };
    }

    if (filter === "custom" && startDate && endDate) {
      
      dateFilter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const matchCondition = {
      ...dateFilter,
      isFinalized: true
    };

    const summary = await Order.aggregate([
      { $match: matchCondition },
      { $unwind: "$orderItems" },
      

      {
        $group: {
          _id: "$_id",

          hasDeliveredItem: {
            $max: {$cond: [{ $eq: ["$orderItems.itemStatus", "delivered"] }, 1, 0]}
          },
          grossSales: {
            $sum: {$cond: [{ $eq: ["$orderItems.itemStatus", "delivered"] },{ $multiply: ["$orderItems.price", "$orderItems.quantity"] },0]}
          },
          couponDiscount: {
            $sum: {$cond: [{ $eq: ["$orderItems.itemStatus", "delivered"] }, "$orderItems.couponShare",0]}
          },
          refundAmount: {
            $sum: { $cond: [{ $in: ["$orderItems.itemStatus", ["cancelled", "returned"]] },"$orderItems.refundAmount",0]}
          },
          offerDiscount: { 
            $sum: {$cond: [{ $eq: ["$orderItems.itemStatus", "delivered"] }, "$orderItems.discount",0]}
           }
        }
      },

      {
        $group: {
      _id: null,

      totalOrders: { $sum:1 },
      totalSalesAmount: { $sum: "$grossSales" },
      totalCouponDiscount: { $sum: "$couponDiscount" },
      totalOfferDiscount: { $sum: "$offerDiscount" },
      totalRefundAmount: { $sum: "$refundAmount" }
    }
  },

  {
    $project: {
      totalOrders: 1,
      totalSalesAmount: 1,
      totalCouponDiscount: 1,
      totalOfferDiscount: 1,
      totalRefundAmount:1,
      netRevenue: {
        $subtract: [
          "$totalSalesAmount",
          { $add: ["$totalCouponDiscount", "$totalOfferDiscount"] }
        ]
      }
    }
  }
]);
    const report = summary[0] || {
      totalOrders: 0,
      totalSalesAmount: 0,
      totalCouponDiscount: 0,
      totalOfferDiscount: 0,
      totalRefundAmount: 0,
      netRevenue: 0
    };


    const orders = await Order.find(matchCondition)
    .populate("userId", "fullName email")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();


  // derive item-based totals per order (for UI)
  orders.forEach(order => {
    order.deliveredAmount = order.orderItems
      .filter(i => i.itemStatus === "delivered")
      .reduce((sum, i) => sum + (i.finalItemAmount || 0), 0);

      order.refundAmount = order.orderItems
      .filter(i => ["cancelled", "returned"].includes(i.itemStatus))
      .reduce((sum, i) => sum + (i.refundAmount || 0), 0);

      const totalFinalAmount = order.orderItems
    .reduce((sum, i) => sum + (i.finalItemAmount || 0), 0);

  order.netAmount = totalFinalAmount - order.refundAmount;
  });


  const totalOrdersCount = await Order.countDocuments(matchCondition);
        
    const totalPages = Math.ceil(totalOrdersCount / limit);

    res.render("admin/sales-report", {
      orders,
      report,
      page: Number(page),
      totalPages,
      query: req.query,
      startDate,
      endDate,
      filter
    });

  } catch (err) {
    next(err);
  }
};
const exportSalesReportPDF = async (req, res, next) => {
  try {
   const { filter = "today", startDate, endDate } = req.query;
   const now = new Date();
   let dateFilter = {};

    /*  DATE FILTER  */
    if (filter === "today") {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      dateFilter.createdAt = { $gte: start };
    }

    if (filter === "week") {
      const start = new Date();
      start.setDate(start.getDate() - 7);
      dateFilter.createdAt = { $gte: start };
    }

    if (filter === "month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFilter.createdAt = { $gte: start };
    }

    if (filter === "year") {
      const start = new Date(now.getFullYear(), 0, 1);
      dateFilter.createdAt = { $gte: start };
    }

    if (filter === "custom" && startDate && endDate) {
      dateFilter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const matchCondition = {
      isFinalized: true,
      ...dateFilter
    };


    const summaryAgg = await Order.aggregate([
      { $match: matchCondition },
      { $unwind: "$orderItems" },

      {
        $group: {
          _id: "$_id",

          hasDeliveredItem: {$max: {$cond: [ { $eq: ["$orderItems.itemStatus", "delivered"] },1,0]}
          },
          grossSales: {$sum: { $cond: [ { $eq: ["$orderItems.itemStatus", "delivered"] }, { $multiply: ["$orderItems.price", "$orderItems.quantity"] },0]}
          },
          couponDiscount: {$sum: {$cond: [{ $eq: ["$orderItems.itemStatus", "delivered"] },"$orderItems.couponShare",0]}
          },
          refundAmount: { $sum: {$cond: [{ $in: ["$orderItems.itemStatus", ["cancelled", "returned"]] },"$orderItems.refundAmount",0]}
          },
          offerDiscount: { 
            $sum: {$cond: [{ $eq: ["$orderItems.itemStatus", "delivered"] },"$orderItems.discount",0]}
          }
        }
      },

      {
        $group: {
      _id: null,

      totalOrders: { $sum: 1 },
      totalSalesAmount: { $sum: "$grossSales" },
      totalCouponDiscount: { $sum: "$couponDiscount" },
      totalOfferDiscount: { $sum: "$offerDiscount" },
      totalRefundAmount: { $sum: "$refundAmount" }
    }
  },

  {
    $project: {
      totalOrders: 1,
      totalSalesAmount: 1,
      totalCouponDiscount: 1,
      totalOfferDiscount: 1,
      totalRefundAmount:1,
      netRevenue: {
        $subtract: [
          "$totalSalesAmount",
          { $add: ["$totalCouponDiscount", "$totalOfferDiscount"] }
        ]
      }
    }
  }
]);

    const summary = summaryAgg[0] || {
  totalOrders: 0,
  totalSalesAmount: 0,
  totalCouponDiscount: 0,
  totalOfferDiscount: 0,
  totalRefundAmount: 0,
  netRevenue: 0
}
/* ORDERS  */
    const orders = await Order.find(matchCondition)
      .populate("userId", "fullName")
      .sort({ createdAt: -1 })
      .lean();

    const doc = new PDFDocument({ margin: 40, size: "A4" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=sales-report-${Date.now()}.pdf`
    );

    doc.pipe(res);
    doc.fontSize(18).text("Sales Report", { align: "center" });
    doc.moveDown();

    doc.fontSize(10).text(
      `Period: ${filter === "custom" ? `${startDate} → ${endDate}` : filter.toUpperCase()}`
    );
    doc.moveDown(2);

    doc.fontSize(12).text("Summary", { underline: true });
    doc.moveDown();

    [
      `Total Orders: ${summary.totalOrders}`,
      `Gross Sales: ₹${summary.totalSalesAmount.toFixed(2)}`,
      `Coupon Discount: ₹${summary.totalCouponDiscount.toFixed(2)}`,
      `Offer Discount: ₹${summary.totalOfferDiscount.toFixed(2)}`,
      `Refund Amount: ₹${summary.totalRefundAmount.toFixed(2)}`,
      `Net Revenue: ₹${summary.netRevenue.toFixed(2)}`
    ].forEach(line => doc.text(line));

    doc.moveDown(2);

    /*TABLE */
    doc.fontSize(11).text("Order Details", { underline: true });
    doc.moveDown();

    const colX = [40, 110, 170, 240, 310, 360, 420, 470];
    const rowHeight = 20;
    const tableTop = doc.y;

    const headers = [
      "Order ID",
      "Date",
      "Payment",
      "Gross",
      "Discount",
      "Refund",
      "Net",
      "Status"
    ];

    headers.forEach((h, i) =>
      doc.fontSize(9).font("Helvetica-Bold").text(h, colX[i], tableTop)
    );

    doc.y = tableTop + rowHeight;
    orders.forEach(order => {
      if (doc.y + rowHeight > doc.page.height - 40) {
        doc.addPage();
        doc.y = 40;
      }

  const deliveredItems = order.orderItems.filter(
    i => i.itemStatus === "delivered"
  );

  const refundedItems = order.orderItems.filter(
    i => ["cancelled", "returned"].includes(i.itemStatus)
  );

  const gross = order.orderItems.reduce(
    (sum, i) => sum + (i.price*i.quantity || 0),
    0
  );

  const coupon = order.orderItems.reduce((sum, i) => sum + (i.couponShare || 0),0)
  const offer = order.orderItems.reduce((sum, i) => sum + (i.discount || 0), 0);
  const refund = refundedItems.reduce((sum, i) => sum + (i.refundAmount || 0),0)
  const discount = coupon + offer;
  const net = gross - (discount +refund);

  const y = doc.y;

  doc.fontSize(8).font("Helvetica")
    .text(order.orderId, colX[0], y,{ width: 60, ellipsis: true })
    .text(new Date(order.createdAt).toLocaleDateString(), colX[1], y,{ width: 55 })
    .text(order.paymentMethod, colX[2], y,{ width: 60, ellipsis: true })
    .text(`₹${gross.toFixed(2)}`, colX[3], y,{ width: 50 })
    .text(`₹${discount.toFixed(2)}`, colX[4], y,{ width: 50 })
    .text(`₹${refund.toFixed(2)}`, colX[5], y,{ width: 50 })
    .text(`₹${net.toFixed(2)}`, colX[6], y,{ width: 50 })
    .text(order.orderStatus || "—", colX[7], y,{ width: 60 });

  doc.y = y + rowHeight;
});

doc.end()
  } catch (err) {
    next(err);
  }
}

const exportSalesReportExcel = async (req, res, next) => {
  try {
    const { filter = "today", startDate, endDate } = req.query;
   const now = new Date();
   let dateFilter = {};

    /*  DATE FILTER  */
    if (filter === "today") {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      dateFilter.createdAt = { $gte: start };
    }

    if (filter === "week") {
      const start = new Date();
      start.setDate(start.getDate() - 7);
      dateFilter.createdAt = { $gte: start };
    }

    if (filter === "month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFilter.createdAt = { $gte: start };
    }

    if (filter === "year") {
      const start = new Date(now.getFullYear(), 0, 1);
      dateFilter.createdAt = { $gte: start };
    }

    if (filter === "custom" && startDate && endDate) {
      dateFilter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const matchCondition = {
      isFinalized: true,
      ...dateFilter
    };


    /*  SUMMARY */
    const summaryAgg = await Order.aggregate([
      { $match: matchCondition },
      { $unwind: "$orderItems" },
      {
        $group: {
          _id: "$_id",
          hasDeliveredItem: {
            $max: { $cond: [{ $eq: ["$orderItems.itemStatus", "delivered"] }, 1, 0] }
          },
          grossSales: {
            $sum: { $cond: [{ $eq: ["$orderItems.itemStatus", "delivered"] }, { $multiply: ["$orderItems.price", "$orderItems.quantity"] }, 0] }
          },
          couponDiscount: {
            $sum: { $cond: [{ $eq: ["$orderItems.itemStatus", "delivered"] }, "$orderItems.couponShare", 0] }
          },
          refundAmount: {
            $sum: { $cond: [{ $in: ["$orderItems.itemStatus", ["cancelled", "returned"]] }, "$orderItems.refundAmount", 0] }
          },
          offerDiscount: {
            $sum: { $cond: [{ $eq: ["$orderItems.itemStatus", "delivered"] }, "$orderItems.discount", 0] }
          }
        }
      },
      {
       $group: {
      _id: null,

      totalOrders: { $sum:1  },
      totalSalesAmount: { $sum: "$grossSales" },
      totalCouponDiscount: { $sum: "$couponDiscount" },
      totalOfferDiscount: { $sum: "$offerDiscount" },
      totalRefundAmount: { $sum: "$refundAmount" }
    }
  },

  {
    $project: {
      totalOrders: 1,
      totalSalesAmount: 1,
      totalCouponDiscount: 1,
      totalOfferDiscount: 1,
      totalRefundAmount:1,
      netRevenue: {
        $subtract: [
          "$totalSalesAmount",
          { $add: ["$totalCouponDiscount", "$totalOfferDiscount"] }
        ]
      }
    }
  }
]);

    const summary = summaryAgg[0] || {
      totalOrders: 0,
      totalSalesAmount: 0,
      totalCouponDiscount: 0,
      totalOfferDiscount: 0,
      totalRefundAmount: 0,
      netRevenue: 0
    };

    /* ORDERS */
    const orders = await Order.find(matchCondition)
      .populate("userId", "fullName")
      .sort({ createdAt: -1 })
      .lean();

    /*  EXCEL SETUP */
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Sales Report");

    worksheet.columns = [
      { header: "Order ID", key: "orderId", width: 20 },
      { header: "Date", key: "date", width: 15 },
      { header: "Payment", key: "payment", width: 15},
      { header: "Gross", key: "gross", width: 15 },
      {header: "Discount", key: "discount", width: 15 },
      { header: "Refund", key: "refund", width: 15 },
      { header: "Net", key: "net", width: 15  },
      { header: "Status", key: "status", width: 15 }
    ];

    worksheet.getRow(1).font = { bold: true };

    worksheet.addRow([]);
    worksheet.addRow(["Summary"]);
    worksheet.addRow(["Total Orders", summary.totalOrders]);
    worksheet.addRow(["Gross Sales", summary.totalSalesAmount]);
    worksheet.addRow(["Coupon Discount", summary.totalCouponDiscount]);
    worksheet.addRow(["Offer Discount", summary.totalOfferDiscount]);
    worksheet.addRow(["Refund Amount", summary.totalRefundAmount]);
    worksheet.addRow(["Net Revenue", summary.netRevenue]);
    worksheet.addRow([]);

    orders.forEach(order => {

      const deliveredItems = order.orderItems.filter( i => i.itemStatus === "delivered")
      const refundedItems = order.orderItems.filter(i => ["cancelled", "returned"].includes(i.itemStatus) )
      const gross = order.orderItems.reduce((sum, i) => sum + (i.price * i.quantity|| 0),0)
      const coupon = order.orderItems.reduce((sum, i) => sum + (i.couponShare || 0),0)
      const offer = deliveredItems.reduce((sum, i) => sum + (i.discount || 0),0)
      const refund = refundedItems.reduce((sum, i) => sum + (i.refundAmount || 0),0)
      const discount = coupon + offer;
      const net = gross - (discount +refund);

      worksheet.addRow({
        orderId: order.orderId,
        date: new Date(order.createdAt).toLocaleDateString(),
        payment: order.paymentMethod,
        gross: gross.toFixed(2),
        discount: discount.toFixed(2),
        refund:refund.toFixed(2),
        net: net.toFixed(2),
        status: order.orderStatus || "-"
      });
    });
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename=sales-report-${Date.now()}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    next(err);
  }
};
module.exports = { 
    getSalesReport,
    exportSalesReportPDF,
    exportSalesReportExcel
 };

