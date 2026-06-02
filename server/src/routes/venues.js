const express = require('express');
const { VENUES } = require('../venues');

const router = express.Router();

router.get('/venues', (req, res) => {
  res.json({ list: VENUES });
});

module.exports = router;
