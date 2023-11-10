const express = require('express');
const connectDB = require('./config/db');
const app = express();

// connect database and view engine
connectDB();
app.set('view-engine', 'ejs');

app.use(express.json({}));
app.use(express.urlencoded({ extended: false }));
app.use('/public', express.static('public'));

// @route  GET home/:name
// @desc   home page render
// @access private
app.get('/', (req, res) => {
    res.send("home")
})

// Routes
app.use('/api/v2/',require('./routes/blog'));

const port = 3000;

app.listen(port, () => console.log(`Listening on port ${port}`));