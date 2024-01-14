const express = require('express');
const connectDB = require('./config/db');
const cors = require('cors');
const app = express();

connectDB(); 

app.set('view-engine', 'ejs');

app.use(cors());
app.use(express.json({}));
app.use(express.urlencoded({ extended: false }));
app.use('/public', express.static('public'));

// @route  GET home/:name
// @desc   home page render
// @access private
app.get('/', (req, res) => {
    res.send("home")
});

// Routes
app.use('/api/anubhav/', require('./routes/blogs'));
app.use('/api/anubhav/', require('./routes/user-feedback'));
app.use('/api/anubhav/', require('./routes/companies'));
app.use('/api/anubhav/', require('./routes/user-reqarticle'));

const port = process.env.PORT || 3000;

app.listen(port, () => console.log(`Listening on port ${port}`));
