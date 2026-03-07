const AppError = require("../config/AppError");
const HTTP_STATUS = require("../middleware/statusCode");

const notFound = (req, res, next) => {
  res.status(404).render("user/page404"); 
}

module.exports = notFound;
