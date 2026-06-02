const express = require('express');
const { requireAdmin } = require('../auth');
const {
  bookingExists,
  createNotification,
  deleteBooking,
  getBookingById,
  listBookingsAdmin,
  setBookingStatus,
} = require('../db');
const { asyncHandler } = require('../middleware/async-handler');
const { notFound } = require('../utils/errors');
const { parseStatus } = require('../utils/validation');

const router = express.Router();

router.get(
  '/admin/bookings',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { venueId, status } = req.query || {};
    const list = await listBookingsAdmin({ venueId, status });
    res.json({ list });
  })
);

router.patch(
  '/admin/bookings/:id/status',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const status = parseStatus((req.body || {}).status);

    const booking = await getBookingById(id);
    if (!booking) {
      throw notFound('Booking not found');
    }

    const row = await setBookingStatus(id, status);

    if (status === 'confirmed' || status === 'rejected') {
      const notificationType = status === 'confirmed' ? 'booking_confirmed' : 'booking_rejected';
      const notificationTitle = status === 'confirmed' ? 'Booking approved' : 'Booking rejected';
      const notificationContent =
        status === 'confirmed'
          ? `Your booking for ${booking.venue_name} on ${booking.date} ${booking.time_slot} was approved.`
          : `Your booking for ${booking.venue_name} on ${booking.date} ${booking.time_slot} was rejected.`;

      await createNotification(
        booking.user_id,
        notificationType,
        notificationTitle,
        notificationContent,
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

module.exports = router;
