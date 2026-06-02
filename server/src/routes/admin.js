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
      const notificationTitle = status === 'confirmed' ? '预约已通过' : '预约已驳回';
      const notificationContent =
        status === 'confirmed'
          ? `你的 ${booking.venue_name} ${booking.date} ${booking.time_slot} 预约已通过。`
          : `你的 ${booking.venue_name} ${booking.date} ${booking.time_slot} 预约已被驳回。`;

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
