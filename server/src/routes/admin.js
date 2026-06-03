const express = require('express');
const { requireAdmin } = require('../auth');
const { isValidVenueId } = require('../venues');
const {
  bookingExists,
  createNotification,
  deleteBooking,
  getAdminStats,
  getBookingById,
  getBookingRules,
  getVenueConfig,
  listBookingsAdmin,
  listVenueConfigs,
  setBookingStatus,
  updateBookingRules,
  updateVenueConfig,
} = require('../db');
const { asyncHandler } = require('../middleware/async-handler');
const { badRequest, notFound } = require('../utils/errors');
const {
  optionalString,
  parseBoolean,
  parseDate,
  parseDurationHours,
  parsePositiveInteger,
  parseStatus,
  parseTime,
} = require('../utils/validation');

const router = express.Router();

router.get(
  '/admin/bookings',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { venueId, status, date } = req.query || {};
    const venue = String(venueId || '').trim();
    const statusStr = String(status || '').trim();
    const dateStr = date ? parseDate(date, 'date') : '';
    const list = await listBookingsAdmin({ venueId: venue, status: statusStr, date: dateStr });
    res.json({ list });
  })
);

router.patch(
  '/admin/bookings/:id/status',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const body = req.body || {};
    const status = parseStatus(body.status);
    const reviewRemark = optionalString(body.reviewRemark, 300);

    const booking = await getBookingById(id);
    if (!booking) {
      throw notFound('Booking not found');
    }

    const row = await setBookingStatus(id, status, reviewRemark);

    if (status === 'confirmed' || status === 'rejected') {
      const notificationType = status === 'confirmed' ? 'booking_confirmed' : 'booking_rejected';
      const notificationTitle = status === 'confirmed' ? '预约已通过' : '预约已驳回';
      const notificationContent =
        status === 'confirmed'
          ? `你的 ${booking.venue_name} ${parseDateForMessage(booking.date)} ${booking.time_slot} 预约已通过。`
          : `你的 ${booking.venue_name} ${parseDateForMessage(booking.date)} ${booking.time_slot} 预约已被驳回。`;

      await createNotification(
        booking.user_id,
        notificationType,
        notificationTitle,
        reviewRemark ? `${notificationContent} 备注：${reviewRemark}` : notificationContent,
        id
      );
    }

    res.json({ booking: row });
  })
);

router.delete(
  '/admin/bookings/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!(await bookingExists(id))) {
      throw notFound('Booking not found');
    }
    await deleteBooking(id);
    res.json({ ok: true });
  })
);

router.get(
  '/admin/stats',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { venueId, date } = req.query || {};
    const stats = await getAdminStats({
      venueId: String(venueId || '').trim(),
      date: date ? parseDate(date, 'date') : '',
    });
    res.json({ stats });
  })
);

router.get(
  '/admin/venues',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const list = await listVenueConfigs();
    res.json({ list });
  })
);

router.put(
  '/admin/venues/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!isValidVenueId(id) || !(await getVenueConfig(id))) {
      throw notFound('Venue not found');
    }
    const fields = parseVenueConfigBody(req.body || {});
    const venue = await updateVenueConfig(id, fields);
    res.json({ venue });
  })
);

router.get(
  '/admin/rules',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const rules = await getBookingRules();
    res.json({ rules });
  })
);

router.put(
  '/admin/rules',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const rules = await updateBookingRules(parseBookingRulesBody(req.body || {}));
    res.json({ rules });
  })
);

function parseVenueConfigBody(body) {
  const out = {};
  if (Object.prototype.hasOwnProperty.call(body, 'name')) out.name = optionalString(body.name, 64);
  if (Object.prototype.hasOwnProperty.call(body, 'desc')) out.desc = optionalString(body.desc, 512);
  if (Object.prototype.hasOwnProperty.call(body, 'location')) out.location = optionalString(body.location, 128);
  if (Object.prototype.hasOwnProperty.call(body, 'openTime')) out.openTime = parseTime(body.openTime, 'openTime');
  if (Object.prototype.hasOwnProperty.call(body, 'closeTime')) out.closeTime = parseTime(body.closeTime, 'closeTime');
  if (Object.prototype.hasOwnProperty.call(body, 'isOpen')) out.isOpen = parseBoolean(body.isOpen, 'isOpen');
  if (Object.prototype.hasOwnProperty.call(body, 'halfCourtEnabled')) out.halfCourtEnabled = parseBoolean(body.halfCourtEnabled, 'halfCourtEnabled');
  if (Object.prototype.hasOwnProperty.call(body, 'rules')) out.rules = optionalString(body.rules, 1000);
  return out;
}

function parseBookingRulesBody(body) {
  const out = {};
  if (Object.prototype.hasOwnProperty.call(body, 'advanceDays')) out.advanceDays = parsePositiveInteger(body.advanceDays, 'advanceDays');
  if (Object.prototype.hasOwnProperty.call(body, 'defaultDurationHours')) out.defaultDurationHours = parseDurationHours(body.defaultDurationHours);
  if (Object.prototype.hasOwnProperty.call(body, 'maxDurationHours')) out.maxDurationHours = parseDurationHours(body.maxDurationHours);
  if (Object.prototype.hasOwnProperty.call(body, 'dailyLimit')) out.dailyLimit = parsePositiveInteger(body.dailyLimit, 'dailyLimit');
  if (Object.prototype.hasOwnProperty.call(body, 'autoApprove')) out.autoApprove = parseBoolean(body.autoApprove, 'autoApprove');
  if (
    out.defaultDurationHours != null &&
    out.maxDurationHours != null &&
    out.defaultDurationHours > out.maxDurationHours
  ) {
    throw badRequest('defaultDurationHours must be less than or equal to maxDurationHours');
  }
  return out;
}

function parseDateForMessage(value) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).slice(0, 10);
}

module.exports = router;
