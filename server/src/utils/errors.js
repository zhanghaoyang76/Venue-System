class AppError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.isOperational = true;
  }
}

function badRequest(message) {
  return new AppError(400, message);
}

function unauthorized(message) {
  return new AppError(401, message);
}

function forbidden(message) {
  return new AppError(403, message);
}

function notFound(message) {
  return new AppError(404, message);
}

function conflict(message) {
  return new AppError(409, message);
}

module.exports = {
  AppError,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
};
