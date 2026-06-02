const express = require('express');

const healthRoutes = require('./routes/health');
const venueRoutes = require('./routes/venues');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const bookingRoutes = require('./routes/bookings');
const adminRoutes = require('./routes/admin');
const notificationRoutes = require('./routes/notifications');

const router = express.Router();

router.use(healthRoutes);
router.use(venueRoutes);
router.use(authRoutes);
router.use(userRoutes);
router.use(bookingRoutes);
router.use(adminRoutes);
router.use(notificationRoutes);

module.exports = router;
