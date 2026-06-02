const express = require('express');
const { requireUser } = require('../auth');
const { getUserById, updateUserProfile } = require('../db');
const { asyncHandler } = require('../middleware/async-handler');
const { optionalString } = require('../utils/validation');

const router = express.Router();

router.get(
  '/me',
  requireUser,
  asyncHandler(async (req, res) => {
    const user = await getUserById(req.user.id);
    res.json({ user });
  })
);

router.put(
  '/me',
  requireUser,
  asyncHandler(async (req, res) => {
    const { name, studentId, phone, college } = req.body || {};
    await updateUserProfile(req.user.id, {
      name: optionalString(name, 128),
      studentId: optionalString(studentId, 64),
      phone: optionalString(phone, 32),
      college: optionalString(college, 128),
    });
    res.json({ ok: true });
  })
);

module.exports = router;
