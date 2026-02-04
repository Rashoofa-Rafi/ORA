const Order = require("../models/orderSchema");
const mongoose = require("mongoose");
const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs")

const getSalesReport = async (req, res, next) => {
  try {
    const {
      filter = "today",
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
      dateFilter = { createdAt: { $gte: start } };
    }

    if (filter === "week") {
      const start = new Date();
      start.setDate(start.getDate() - 7);
      dateFilter = { createdAt: { $gte: start } };
    }

    if (filter === "month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFilter = { createdAt: { $gte: start } };
    }

    if (filter === "year") {
      const start = new Date(now.getFullYear(), 0, 1);
      dateFilter = { createdAt: { $gte: start } };
    }

    if (filter === "custom" && startDate && endDate) {
      dateFilter = {
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
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
            $sum: {$cond: [{ $eq: ["$orderItems.itemStatus", "delivered"] }, "$orderItems.finalItemAmount",0]}
          },
          couponDiscount: {
            $sum: {$cond: [{ $eq: ["$orderItems.itemStatus", "delivered"] }, "$orderItems.couponShare",0]}
          },
          refundAmount: {
            $sum: { $cond: [{ $in: ["$orderItems.itemStatus", ["cancelled", "returned"]] },"$orderItems.refundAmount",0]}
          },
          offerDiscount: { $first: "$offerDiscount" }
        }
      },

      {
        $group: {
          _id: null,

          totalOrders: {
            $sum: "$hasDeliveredItem"
          },

          totalSalesAmount: {
            $sum: "$grossSales"
          },

          totalCouponDiscount: {
            $sum: "$couponDiscount"
          },

          totalOfferDiscount: {
            $sum: {
              $cond: [{ $eq: ["$hasDeliveredItem", 1] }, "$offerDiscount", 0]
            }
          },

          totalRefundAmount: {
            $sum: "$refundAmount"
          },

          netRevenue: {
            $sum: {
              $subtract: [
                { $subtract: ["$grossSales", "$couponDiscount"] },
                { $add: ["$offerDiscount", "$refundAmount"] }
              ]
            }
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
    const { startDate, endDate } = req.query;

    /* -------------------- MATCH CONDITION -------------------- */
    const matchCondition = { isFinalized: true };

    if (startDate && endDate) {
      matchCondition.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const summaryAgg = await Order.aggregate([
      { $match: matchCondition },
      { $unwind: "$orderItems" },

      {
        $group: {
          _id: "$_id",

          hasDeliveredItem: {$max: {$cond: [ { $eq: ["$orderItems.itemStatus", "delivered"] },1,0]}
          },
          grossSales: {$sum: { $cond: [ { $eq: ["$orderItems.itemStatus", "delivered"] }, "$orderItems.finalItemAmount",0]}
          },
          couponDiscount: {$sum: {$cond: [{ $eq: ["$orderItems.itemStatus", "delivered"] },"$orderItems.couponShare",0]}
          },
          refundAmount: { $sum: {$cond: [{ $in: ["$orderItems.itemStatus", ["cancelled", "returned"]] },"$orderItems.refundAmount",0]}
          },
          offerDiscount: { $first: "$offerDiscount" }
        }
      },

      {
        $group: {
          _id: null,

          totalOrders: { $sum: "$hasDeliveredItem" },
          totalSales: { $sum: "$grossSales" },
          couponDiscount: { $sum: "$couponDiscount" },

          offerDiscount: {
            $sum: { $cond: [ { $eq: ["$hasDeliveredItem", 1] },"$offerDiscount",0]}
          },

          refundAmount: { $sum: "$refundAmount" },

          netRevenue: {
            $sum: {
              $subtract: [
                { $subtract: ["$grossSales", "$couponDiscount"] },
                { $add: ["$offerDiscount", "$refundAmount"] }
              ]
            }
          }
        }
      }
    ]);

    const summary = summaryAgg[0] || {
      totalOrders: 0,
      totalSales: 0,
      couponDiscount: 0,
      offerDiscount: 0,
      refundAmount: 0,
      netRevenue: 0
    };

    /*  ORDERS FOR TABLE  */
    const orders = await Order.find(matchCondition)
      .populate("userId", "fullName")
      .sort({ createdAt: -1 })
      .lean();

    /* PDF SETUP */
    const doc = new PDFDocument({ margin: 40, size: "A4" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=sales-report-${Date.now()}.pdf`
    );

    doc.pipe(res);

    /*HEADER  */
    doc.fontSize(18).text("Sales Report", { align: "center" });
    doc.moveDown();

    doc
      .fontSize(10)
      .text(`Period: ${startDate || "All"} → ${endDate || "All"}`);
    doc.moveDown(2);

    /*  SUMMARY  */
    doc.fontSize(12).text("Summary", { underline: true });
    doc.moveDown();

    const summaryLines = [
      `Total Orders: ${summary.totalOrders}`,
      `Gross Sales: ₹${summary.totalSales.toFixed(2)}`,
      `Coupon Discount: ₹${summary.couponDiscount.toFixed(2)}`,
      `Offer Discount: ₹${summary.offerDiscount.toFixed(2)}`,
      `Refund Amount: ₹${summary.refundAmount.toFixed(2)}`,
      `Net Revenue: ₹${summary.netRevenue.toFixed(2)}`
    ];

    summaryLines.forEach(line => doc.text(line));
    doc.moveDown(2);

    /* TABLE HEADER  */
    doc.fontSize(11).text("Order Details", { underline: true });
    doc.moveDown();

    const colX = [40, 110, 200, 290, 360, 430];
    const headers = ["Order ID", "Date", "Customer", "Payment", "Gross", "Net"];

    headers.forEach((h, i) =>
      doc.fontSize(9).text(h, colX[i], doc.y)
    );

    doc.moveDown();

    /* TABLE ROWS */
    orders.forEach(order => {
      const deliveredItems = order.orderItems.filter(
        i => i.itemStatus === "delivered"
      );

      if (deliveredItems.length === 0) return;

      const gross = deliveredItems.reduce(
        (sum, i) => sum + (i.finalItemAmount || 0),
        0
      );

      doc
        .fontSize(8)
        .text(order.orderId, colX[0], doc.y)
        .text(
          new Date(order.createdAt).toLocaleDateString(),
          colX[1],
          doc.y
        )
        .text(order.userId?.fullName || "Guest", colX[2], doc.y)
        .text(order.paymentMethod, colX[3], doc.y)
        .text(`₹${gross.toFixed(2)}`, colX[4], doc.y)
        .text(`₹${order.finalAmount.toFixed(2)}`, colX[5], doc.y);

      doc.moveDown();
    });
console.log("🔥 PDF CONTROLLER HIT");
    doc.end();
  } catch (err) {
    next(err);
  }
}

const exportSalesReportExcel = async (req, res) => {
  try {
    const { filter, startDate, endDate } = req.query;

    const matchCondition = { isFinalized: true };
    const now = new Date();

    if (filter === "today") {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      matchCondition.createdAt = { $gte: start };
    }

    if (filter === "week") {
      const start = new Date();
      start.setDate(start.getDate() - 7);
      matchCondition.createdAt = { $gte: start };
    }

    if (filter === "month") {
      matchCondition.createdAt = {
        $gte: new Date(now.getFullYear(), now.getMonth(), 1)
      };
    }

    if (filter === "year") {
      matchCondition.createdAt = {
        $gte: new Date(now.getFullYear(), 0, 1)
      };
    }

    if (filter === "custom" && startDate && endDate) {
      matchCondition.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    
    const data = await Order.aggregate([
      { $match: matchCondition },
      { $unwind: "$orderItems" },

      {
        $group: {
          _id: "$_id",
          orderId: { $first: "$orderId" },
          createdAt: { $first: "$createdAt" },
          paymentMethod: { $first: "$paymentMethod" },
          customer: { $first: "$userId" },

          gross: {
            $sum: { $cond: [{ $eq: ["$orderItems.itemStatus", "delivered"] },"$orderItems.finalItemAmount",0]}
          },
          couponDiscount: {
            $sum: { $cond: [{ $eq: ["$orderItems.itemStatus", "delivered"] }, "$orderItems.couponShare",0]}
          },

          refundAmount: {
            $sum: {$cond: [{ $in: ["$orderItems.itemStatus", ["cancelled", "returned"]] },"$orderItems.refundAmount",0]}
          },

          offerDiscount: { $first: "$offerDiscount" },
          finalAmount: { $first: "$finalAmount" },

          hasDeliveredItem: {
            $max: { $cond: [{ $eq: ["$orderItems.itemStatus", "delivered"] },1,0]}
          }
        }
      },

      { $match: { hasDeliveredItem: 1 } }
    ]);

    /*  EXCEL- */
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Sales Report");

    sheet.columns = [
      { header: "Order ID", key: "orderId", width: 20 },
      { header: "Date", key: "date", width: 15 },
      { header: "Payment", key: "payment", width: 15 },
      { header: "Gross", key: "gross", width: 15 },
      { header: "Offer Discount", key: "offer", width: 18 },
      { header: "Coupon Discount", key: "coupon", width: 18 },
      { header: "Refund", key: "refund", width: 15 },
      { header: "Net Revenue", key: "net", width: 15 }
    ];

    sheet.getRow(1).font = { bold: true };

    let totals = {
      gross: 0,
      offer: 0,
      coupon: 0,
      refund: 0,
      net: 0
    };

    data.forEach(o => {
      sheet.addRow({
        orderId: o.orderId,
        date: o.createdAt.toISOString().split("T")[0],
        payment: o.paymentMethod,
        gross: o.gross,
        offer: o.offerDiscount || 0,
        coupon: o.couponDiscount,
        refund: o.refundAmount,
        net:
          o.gross -
          o.couponDiscount -
          (o.offerDiscount || 0) -
          o.refundAmount
      });

      totals.gross += o.gross;
      totals.offer += o.offerDiscount || 0;
      totals.coupon += o.couponDiscount;
      totals.refund += o.refundAmount;
      totals.net +=
        o.gross -
        o.couponDiscount -
        (o.offerDiscount || 0) -
        o.refundAmount;
    });

    sheet.addRow({});
    const totalRow = sheet.addRow({
      orderId: "TOTAL",
      gross: totals.gross,
      offer: totals.offer,
      coupon: totals.coupon,
      refund: totals.refund,
      net: totals.net
    });
    totalRow.font = { bold: true };

    /* RESPONSE */
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=sales-report.xlsx"
    );
console.log("🔥 EXCEL CONTROLLER HIT");
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Excel export failed:", err);
    res.status(500).json({ message: "Excel export failed" });
  }
};


module.exports = { 
    getSalesReport,
    exportSalesReportPDF,
    exportSalesReportExcel
 };

