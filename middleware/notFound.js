const AppError = require("../config/AppError");
const HTTP_STATUS = require("../middleware/statusCode");

const notFound = (req, res, next) => {
  next(
    new AppError(`Route not found: ${req.originalUrl}`, HTTP_STATUS.NOT_FOUND)
  );
};

module.exports = notFound;
