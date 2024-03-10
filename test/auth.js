const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authMiddleware')

router.get('/protected-route', authenticate.decodeToken, (req, res) => {
    res.send({message: req.user});
});


router.get('/unprotected-route', (req, res) => {
    res.send('This route is not protected and does not require authentication.');
});

module.exports = router;