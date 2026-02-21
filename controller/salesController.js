const Order = require("../models/orderSchema");
const mongoose = require("mongoose");
const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs")


const getSalesReport = async (req, res, next) => {
  try {
    const {
      filter = "year",
      startDate,
      endDate,
      page = 1
    } = req.query;


    const limit = 10;
    const skip = (page - 1) * limit;


    let dateFilter = {};
    const now = new Date();


    if (filter === "today") {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      dateFilter = {
        orderItems: {$elemMatch: {deliveryDate: { $gte: start }}}
      };
    }
   
   


    if (filter === "week") {
      const start = new Date();
      start.setDate(start.getDate() - 7);
      dateFilter = {
        orderItems: {$elemMatch: {deliveryDate: { $gte: start } }}
      };
    }


    if (filter === "month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFilter = {
        orderItems: {$elemMatch: {deliveryDate: { $gte: start } }}
      };
    }


    if (filter === "year") {
      const start = new Date(now.getFullYear(), 0, 1);
      dateFilter = {
        orderItems: {$elemMatch: {deliveryDate: { $gte: start } }}
      };
    }


    if (filter === "custom" && startDate && endDate) {
      dateFilter = {
        orderItems: {$elemMatch: {deliveryDate: {
              $gte: new Date(startDate),
              $lte: new Date(endDate)
            }
          }
        }
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

      totalOrders: { $sum: { $cond: [{ $eq: ["$hasDeliveredItem", 1] }, 1, 0] } },
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

    /* ---------------- DATE FILTER (MATCH UI EXACTLY) ---------------- */
    const now = new Date();
    let dateFilter = {};

    if (filter === "today") {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      dateFilter = {
        orderItems: {$elemMatch: {deliveryDate: { $gte: start } }}
      };
    }

    if (filter === "week") {
      const start = new Date();
      start.setDate(start.getDate() - 7);
      dateFilter = {
        orderItems: {$elemMatch: {deliveryDate: { $gte: start } }}
      };
    }

    if (filter === "month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFilter = {
        orderItems: {$elemMatch: {deliveryDate: { $gte: start } }}
      };
    }

    if (filter === "year") {
      const start = new Date(now.getFullYear(), 0, 1);
      dateFilter = {
        orderItems: {$elemMatch: {deliveryDate: { $gte: start } }}
      };
    }

    if (filter === "custom" && startDate && endDate) {
      dateFilter = {
        orderItems: {$elemMatch: {deliveryDate: {
              $gte: new Date(startDate),
              $lte: new Date(endDate)
            }
          }
        }
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

      totalOrders: { $sum: { $cond: [{ $eq: ["$hasDeliveredItem", 1] }, 1, 0] } },
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

   /* ---------------- ORDERS (MATCH SUMMARY DATASET) ---------------- */
    const orders = await Order.find({
      ...matchCondition,
      orderItems: { $elemMatch: { itemStatus: "delivered" } }
    })
      .populate("userId", "fullName")
      .sort({ createdAt: -1 })
      .lean();

    /* ---------------- PDF SETUP ---------------- */
    const doc = new PDFDocument({ margin: 40, size: "A4" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=sales-report-${Date.now()}.pdf`
    );

    doc.pipe(res);

    /* ---------------- HEADER ---------------- */
    doc.fontSize(18).text("Sales Report", { align: "center" });
    doc.moveDown();

    doc.fontSize(10).text(
      `Period: ${filter === "custom" ? `${startDate} → ${endDate}` : filter.toUpperCase()}`
    );
    doc.moveDown(2);

    /* ---------------- SUMMARY ---------------- */
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

    /* ---------------- TABLE ---------------- */
    doc.fontSize(11).text("Order Details", { underline: true });
    doc.moveDown();

    const colX = [40, 130, 210, 300, 380, 440, 500, 560];
    const rowHeight = 20;
    const tableTop = doc.y;

    const headers = [
      "Order ID",
      "Date",
      "Customer",
      "Payment",
      "Net",
      "Discount",
      "Gross",
      "Status"
    ];

    headers.forEach((h, i) =>
      doc.fontSize(9).font("Helvetica-Bold").text(h, colX[i], tableTop)
    );

    doc.y = tableTop + rowHeight;
orders.forEach(order => {

  // Delivered items (for money)
  const deliveredItems = order.orderItems.filter(
    i => i.itemStatus === "delivered"
  );

  // Cancelled / Returned (for refund display only)
  const refundedItems = order.orderItems.filter(
    i => ["cancelled", "returned"].includes(i.itemStatus)
  );

  const gross = deliveredItems.reduce(
    (sum, i) => sum + (i.price*i.quantity || 0),
    0
  );

  const coupon = deliveredItems.reduce(
    (sum, i) => sum + (i.couponShare || 0),
    0
  );

  const offer = deliveredItems.reduce((sum, i) => sum + (i.discount || 0), 0);
  const refund = refundedItems.reduce(
    (sum, i) => sum + (i.refundAmount || 0),
    0
  );

  const discount = coupon + offer;
  const net = gross - discount ;

  const y = doc.y;

  doc.fontSize(8).font("Helvetica")
    .text(order.orderId, colX[0], y)
    .text(new Date(order.createdAt).toLocaleDateString(), colX[1], y)
    .text(order.userId?.fullName || "Guest", colX[2], y)
    .text(order.paymentMethod, colX[3], y)
    .text(`₹${net.toFixed(2)}`, colX[4], y)
    .text(`₹${discount.toFixed(2)}`, colX[5], y)
    .text(`₹${gross.toFixed(2)}`, colX[6], y)
    .text(order.orderStatus || "—", colX[7], y);

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

    /* ---------------- DATE FILTER (MATCH PDF EXACTLY) ---------------- */
    const now = new Date();
    let dateFilter = {};

    if (filter === "today") {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      dateFilter = {
        orderItems: {$elemMatch: {deliveryDate: { $gte: start } }}
      };
    }

    if (filter === "week") {
      const start = new Date();
      start.setDate(start.getDate() - 7);
      dateFilter = {
        orderItems: {$elemMatch: {deliveryDate: { $gte: start } }}
      };
    }

    if (filter === "month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFilter = {
        orderItems: {$elemMatch: {deliveryDate: { $gte: start } }}
      };
    }

    if (filter === "year") {
      const start = new Date(now.getFullYear(), 0, 1);
      dateFilter = {
        orderItems: {$elemMatch: {deliveryDate: { $gte: start } }}
      };
    }

    if (filter === "custom" && startDate && endDate) {
      dateFilter = {
        orderItems: {$elemMatch: {deliveryDate: {
              $gte: new Date(startDate),
              $lte: new Date(endDate)
            }
          }
        }
      };
    }

    const matchCondition = {
      isFinalized: true,
      ...dateFilter
    };

    /* ---------------- SUMMARY (SAME AS PDF) ---------------- */
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

      totalOrders: { $sum: { $cond: [{ $eq: ["$hasDeliveredItem", 1] }, 1, 0] }  },
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

    /* ---------------- ORDERS (MATCH PDF DATASET) ---------------- */
    const orders = await Order.find({
      ...matchCondition,
      orderItems: { $elemMatch: { itemStatus: "delivered" } }
    })
      .populate("userId", "fullName")
      .sort({ createdAt: -1 })
      .lean();

    /* ---------------- EXCEL SETUP ---------------- */
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Sales Report");

    worksheet.columns = [
      { header: "Order ID", key: "orderId", width: 20 },
      { header: "Date", key: "date", width: 15 },
      { header: "Customer", key: "customer", width: 25 },
      { header: "Payment", key: "payment", width: 15 },
      { header: "Net", key: "net", width: 15 },
      { header: "Discount", key: "discount", width: 15 },
      { header: "Gross", key: "gross", width: 15 },
      { header: "Status", key: "status", width: 15 }
    ];

    worksheet.getRow(1).font = { bold: true };

    /* ---------------- SUMMARY ROWS ---------------- */
    worksheet.addRow([]);
    worksheet.addRow(["Summary"]);
    worksheet.addRow(["Total Orders", summary.totalOrders]);
    worksheet.addRow(["Gross Sales", summary.totalSalesAmount]);
    worksheet.addRow(["Coupon Discount", summary.totalCouponDiscount]);
    worksheet.addRow(["Offer Discount", summary.totalOfferDiscount]);
    worksheet.addRow(["Refund Amount", summary.totalRefundAmount]);
    worksheet.addRow(["Net Revenue", summary.netRevenue]);
    worksheet.addRow([]);

    /* ---------------- ORDER ROWS ---------------- */
    orders.forEach(order => {

      const deliveredItems = order.orderItems.filter(
        i => i.itemStatus === "delivered"
      );

      const refundedItems = order.orderItems.filter(
        i => ["cancelled", "returned"].includes(i.itemStatus)
      );

      const gross = deliveredItems.reduce(
        (sum, i) => sum + (i.price * i.quantity|| 0),
        0
      );

      const coupon = deliveredItems.reduce(
        (sum, i) => sum + (i.couponShare || 0),
        0
      );

      const offer = deliveredItems.reduce(
        (sum, i) => sum + (i.discount || 0),
        0
      );

      const refund = refundedItems.reduce(
        (sum, i) => sum + (i.refundAmount || 0),
        0
      );

      const discount = coupon + offer;
      const net = gross - discount ;

      worksheet.addRow({
        orderId: order.orderId,
        date: new Date(order.createdAt).toLocaleDateString(),
        customer: order.userId?.fullName || "Guest",
        payment: order.paymentMethod,
        net: net.toFixed(2),
        discount: discount.toFixed(2),
        gross: gross.toFixed(2),
        status: order.orderStatus || "-"
      });
    });

    /* ---------------- RESPONSE ---------------- */
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

