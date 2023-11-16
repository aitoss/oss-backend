// @route  GET /api/anubhav/requests
// @desc   Get requests
// @access Public
const express = require('express');
const router = express.Router();
const requestController = require('./controller');

router.get('/requests', requestController.getAllRequests);

module.exports = router;
