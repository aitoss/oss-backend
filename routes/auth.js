const express = require('express');
const router = express.Router();
const admin = require('../config/firebaseConfig');

// User signup
router.post('/signup', (req, res) => {
    const { email, password } = req.body;
    console.log(email, password);
    // admin.auth().createUser({
    //     email: email,
    //     password: password
    // })
    // .then(userRecord => {
    //     // See the UserRecord reference doc for the contents of userRecord.
    //     console.log('Successfully created new user:', userRecord.uid);
    //     res.send('User created successfully');
    // })
    // .catch(error => {
    //     console.log('Error creating new user:', error);
    //     res.status(400).send(error.message);
    // });
    res.send(email + " " + password);
});

// User login
router.post('/login', (req, res) => {
    const { email, password } = req.body;
    // In a real app, you'd validate the email and password with Firebase Authentication.
    // Here, you might return a custom token or session cookie.
    // This example just simplifies the process to focus on route setup.
    res.send(`Login attempt for ${email}. Replace this with real Firebase Auth login logic.`);
});

module.exports = router;
