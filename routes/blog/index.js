
// @route  GET /api/anubhav/blogs
// @desc   Get companies
// @access Public
const express = require('express');
const router = express.Router();
const blogController = require('./controller');

router.get('/blogs', blogController.getAllBlogs);

module.exports = router;
