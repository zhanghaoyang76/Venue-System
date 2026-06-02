const { AppError } = require('../utils/errors');

function notFoundHandler(req, res) {
  res.status(404).json({ error: 'API endpoint not found' });
}

function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
}

module.exports = {
  notFoundHandler,
  errorHandler,
};
