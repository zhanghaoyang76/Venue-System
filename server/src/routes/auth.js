const express = require('express');
const config = require('../config');
const { codeToOpenId } = require('../wechat');
const { signToken } = require('../auth');
const { upsertUserByOpenId } = require('../db');
const { asyncHandler } = require('../middleware/async-handler');
const { badRequest } = require('../utils/errors');

const router = express.Router();

router.post(
  '/auth/login',
  asyncHandler(async (req, res) => {
    const { code, mockOpenId } = req.body || {};
    let openid;

    if (config.mockAuth && typeof mockOpenId === 'string' && mockOpenId.trim()) {
      openid = mockOpenId.trim();
    } else if (typeof code === 'string' && code.trim()) {
      openid = await codeToOpenId(code.trim());
    } else {
      throw badRequest('Provide code or mockOpenId');
    }

    const user = await upsertUserByOpenId(openid);
    const token = signToken(user);
    res.json({ token, user });
  })
);

module.exports = router;
