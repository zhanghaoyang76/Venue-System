const express = require('express');
const { VENUES } = require('../venues');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({
    ok: true,
    ts: Date.now(),
    venues: VENUES.length,
  });
});

module.exports = router;
