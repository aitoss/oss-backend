
// @route  GET /api/anubhav/blogs
// @desc   Get companies
// @access Public
const express = require('express');
const router = express.Router();
const blogController = require('./controller');

router.get('/blogs', blogController.getAllBlogs);
router.route('/').post(addBlog).get(blogController.getAllBlogs);
router.route('/:blogId').get(blogController.getBlog)

module.exports = router;
