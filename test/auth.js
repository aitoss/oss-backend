const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authMiddleware')

// @route  GET /api/anubhav/protected-route
// @desc   test firebase authentication middleware
// @access private
// @middleware authenticate.decodeToken - this middleware will check if the token is valid
// token will be added to the request header as 'authorization' : bearer token
router.get('/protected-route', authenticate.decodeToken, (req, res) => {
    res.send({message: req.user});
});

// @route  GET /api/anubhav/unprotected-route
// @desc   test unprotected route
// @access public
router.get('/unprotected-route', (req, res) => {
    res.send('This route is not protected and does not require authentication.');
});

module.exports = router;