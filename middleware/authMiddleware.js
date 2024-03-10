const admin = require('../config/firebaseConfig');

// Middleware class for handling authentication
class Middleware {
    // Method to decode and verify the token
    async decodeToken(req, res, next) {
        const token = req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).send({message : 'Access denied. No token provided.'});
        }

        try {
            const decodeValue = await admin.auth().verifyIdToken(token);

            if (decodeValue) {
                req.user = decodeValue;
                return next();
            }

            return res.status(401).json({ message: 'Unauthorized' });
        } catch (e) {
            console.log(e);
            return res.status(500).json({ message: 'Internal Server Error' });
        }
    }
}

module.exports = new Middleware();