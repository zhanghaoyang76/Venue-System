const express = require('express');
const { getVenueConfig, listVenueConfigs } = require('../db');
const { asyncHandler } = require('../middleware/async-handler');
const { notFound } = require('../utils/errors');

const router = express.Router();

router.get(
  '/venues',
  asyncHandler(async (req, res) => {
    const list = await listVenueConfigs();
    res.json({ list });
  })
);

router.get(
  '/venues/:id',
  asyncHandler(async (req, res) => {
    const venue = await getVenueConfig(req.params.id);
    if (!venue) {
      throw notFound('Venue not found');
    }
    res.json({ venue });
  })
);

module.exports = router;
