const HTTP_STATUS = require("../middleware/statusCode");

const errorHandler = (err, req, res, next) => {
  const statusCode =
    err.statusCode && Object.values(HTTP_STATUS).includes(err.statusCode)
      ? err.statusCode
      : HTTP_STATUS.INTERNAL_SERVER_ERROR;
console.log('exist')
  console.error("ERROR ", err);

  res.status(statusCode).json({
    success: false,
    message: err.message || "Something went wrong",
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
};

module.exports = errorHandler;
