const express = require('express');
const router = express.Router();
const feedbackController = require('./controller');

router.get('/feedback', feedbackController.getFeedback);

module.exports = router;
