const { badRequest } = require('./errors');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function requireString(value, fieldName) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw badRequest(`${fieldName} is required`);
  }
  return value.trim();
}

function optionalString(value, maxLength) {
  if (value == null) return '';
  return String(value).trim().slice(0, maxLength);
}

function parseDate(value, fieldName = 'date') {
  const out = requireString(value, fieldName);
  if (!DATE_RE.test(out)) {
    throw badRequest(`${fieldName} must be YYYY-MM-DD`);
  }
  return out;
}

function parseTime(value, fieldName = 'timeSlot') {
  const out = requireString(value, fieldName);
  if (!TIME_RE.test(out)) {
    throw badRequest(`${fieldName} must be HH:mm`);
  }
  return out;
}

function parseDurationHours(value) {
  const duration = Number(value ?? 1);
  const allowed = [1, 1.5, 2, 2.5, 3];
  if (!allowed.includes(duration)) {
    throw badRequest('durationHours must be one of 1, 1.5, 2, 2.5, 3');
  }
  return duration;
}

function parseCourtType(value) {
  const courtType = String(value || 'full');
  if (!['full', 'half'].includes(courtType)) {
    throw badRequest('courtType must be full or half');
  }
  return courtType;
}

function parseStatus(value) {
  if (!['pending', 'confirmed', 'rejected'].includes(value)) {
    throw badRequest('status must be pending, confirmed, or rejected');
  }
  return value;
}

function parsePositiveInteger(value, fieldName) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw badRequest(`${fieldName} must be a positive integer`);
  }
  return n;
}

module.exports = {
  requireString,
  optionalString,
  parseDate,
  parseTime,
  parseDurationHours,
  parseCourtType,
  parseStatus,
  parsePositiveInteger,
};
