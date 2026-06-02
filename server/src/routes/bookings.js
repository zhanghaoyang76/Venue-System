const express = require('express');
const { requireUser } = require('../auth');
const { getVenue, isValidVenueId } = require('../venues');
const {
  hasSlotConflict,
  createBooking,
  listMyBookings,
  rowToBooking,
  createNotification,
} = require('../db');
const { asyncHandler } = require('../middleware/async-handler');
const { badRequest, conflict, forbidden } = require('../utils/errors');
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
      '预约已提交',
      `你已提交 ${venue.name} ${dateStr} ${startTime} 的预约申请。`,
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

module.exports = router;
