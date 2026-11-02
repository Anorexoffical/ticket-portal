export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  const status = error.status || 500;
  res.status(status).json({ message: status === 500 ? 'Internal server error' : error.message });
  if (status === 500) console.error(error);
}
