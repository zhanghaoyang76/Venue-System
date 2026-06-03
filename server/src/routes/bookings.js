const express = require('express');
const { requireUser } = require('../auth');
const { getVenue, isValidVenueId } = require('../venues');
const {
  hasSlotConflict,
  createBooking,
  cancelBooking,
  countUserBookingsForDate,
  getBookingForUser,
  getBookingRules,
  getVenueConfig,
  listMyBookings,
  rowToBooking,
  createNotification,
} = require('../db');
const { asyncHandler } = require('../middleware/async-handler');
const { badRequest, conflict, forbidden, notFound } = require('../utils/errors');
const { buildTimeRange, timeToMinutes } = require('../utils/time');
const {
  optionalString,
  parseCourtType,
  parseDate,
  parseDurationHours,
  parseTime,
} = require('../utils/validation');

const router = express.Router();

router.post(
  '/bookings',
  requireUser,
  asyncHandler(async (req, res) => {
    if (req.user.role !== 'user') {
      throw forbidden('Use a user account to create bookings');
    }

    const { venueId, date, timeSlot, remark, courtType, durationHours } = req.body || {};
    const venueIdStr = String(venueId || '').trim();
    if (!isValidVenueId(venueIdStr)) {
      throw badRequest('Invalid venueId');
    }

    const venue = getVenue(venueIdStr);
    const dateStr = parseDate(date);
    const startTime = parseTime(timeSlot);
    const duration = parseDurationHours(durationHours);
    const court = parseCourtType(courtType);
    const remarkStr = optionalString(remark, 200);
    const venueConfig = await getVenueConfig(venueIdStr);
    const rules = await getBookingRules();

    if (venueConfig && !venueConfig.isOpen) {
      throw badRequest('Venue is closed');
    }
    if (court === 'half' && venueConfig && !venueConfig.halfCourtEnabled) {
      throw badRequest('Half-court booking is not enabled for this venue');
    }
    if (rules && duration > rules.maxDurationHours) {
      throw badRequest(`durationHours must be less than or equal to ${rules.maxDurationHours}`);
    }
    validateBookingDate(dateStr, rules ? rules.advanceDays : 14);
    validateVenueTime(startTime, duration, venueConfig);

    const dailyCount = await countUserBookingsForDate(req.user.id, dateStr);
    if (rules && dailyCount >= rules.dailyLimit) {
      throw badRequest(`Daily booking limit is ${rules.dailyLimit}`);
    }

    if (await hasSlotConflict(venueIdStr, dateStr, startTime, duration)) {
      throw conflict('This time slot is already booked');
    }

    const row = await createBooking(
      req.user.id,
      venueIdStr,
      dateStr,
      startTime,
      remarkStr,
      court,
      duration
    );

    await createNotification(
      req.user.id,
      'booking_created',
      row.status === 'confirmed' ? '预约已通过' : '预约已提交',
      row.status === 'confirmed'
        ? `你的 ${venue.name} ${dateStr} ${row.time_slot} 预约已自动通过。`
        : `你已提交 ${venue.name} ${dateStr} ${row.time_slot} 的预约申请。`,
      row.id
    );

    res.status(201).json({ booking: rowToBooking(row) });
  })
);

router.get(
  '/bookings',
  requireUser,
  asyncHandler(async (req, res) => {
    const list = await listMyBookings(req.user.id);
    res.json({ list });
  })
);

router.get(
  '/bookings/mine',
  requireUser,
  asyncHandler(async (req, res) => {
    const list = await listMyBookings(req.user.id);
    res.json({ list });
  })
);

router.get(
  '/bookings/:id',
  requireUser,
  asyncHandler(async (req, res) => {
    const booking = await getBookingForUser(req.user.id, req.params.id);
    if (!booking) {
      throw notFound('Booking not found');
    }
    res.json({ booking });
  })
);

router.patch(
  '/bookings/:id/cancel',
  requireUser,
  asyncHandler(async (req, res) => {
    const existing = await getBookingForUser(req.user.id, req.params.id);
    if (!existing) {
      throw notFound('Booking not found');
    }
    if (!['pending', 'confirmed'].includes(existing.status)) {
      throw badRequest('Only pending or confirmed bookings can be cancelled');
    }
    const booking = await cancelBooking(req.user.id, req.params.id);
    res.json({ booking });
  })
);

function validateBookingDate(dateStr, advanceDays) {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  if (dateStr < todayStr) {
    throw badRequest('date cannot be in the past');
  }
  const max = new Date(today.getTime());
  max.setDate(max.getDate() + Number(advanceDays || 14));
  const maxStr = max.toISOString().slice(0, 10);
  if (dateStr > maxStr) {
    throw badRequest(`date must be within ${advanceDays} days`);
  }
}

function validateVenueTime(startTime, duration, venueConfig) {
  if (!venueConfig) return;
  const requested = buildTimeRange(startTime, duration);
  const open = timeToMinutes(venueConfig.openTime);
  const close = timeToMinutes(venueConfig.closeTime);
  if (!requested || open == null || close == null) return;
  if (requested.start < open || requested.end > close) {
    throw badRequest(`timeSlot must be between ${venueConfig.openTime} and ${venueConfig.closeTime}`);
  }
}

module.exports = router;
