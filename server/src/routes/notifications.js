const express = require('express');
const { requireUser } = require('../auth');
const {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUnreadNotificationCount,
} = require('../db');
const { asyncHandler } = require('../middleware/async-handler');
const { parseBoolean, parsePositiveInteger } = require('../utils/validation');

const router = express.Router();

router.get(
  '/notifications',
  requireUser,
  asyncHandler(async (req, res) => {
    const limit = req.query.limit ? parsePositiveInteger(req.query.limit, 'limit') : 20;
    const unreadOnly = req.query.unreadOnly ? parseBoolean(req.query.unreadOnly, 'unreadOnly') : false;
    const notifications = await getUserNotifications(req.user.id, Math.min(limit, 100), unreadOnly);
    res.json({ list: notifications });
  })
);

router.get(
  '/notifications/unread-count',
  requireUser,
  asyncHandler(async (req, res) => {
    const count = await getUnreadNotificationCount(req.user.id);
    res.json({ count });
  })
);

router.patch(
  '/notifications/:id/read',
  requireUser,
  asyncHandler(async (req, res) => {
    const id = parsePositiveInteger(req.params.id, 'notification id');
    await markNotificationAsRead(req.user.id, id);
    res.json({ ok: true });
  })
);

router.patch(
  '/notifications/read-all',
  requireUser,
  asyncHandler(async (req, res) => {
    await markAllNotificationsAsRead(req.user.id);
    res.json({ ok: true });
  })
);

module.exports = router;
