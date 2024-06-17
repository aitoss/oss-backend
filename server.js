const express = require('express');
const connectDB = require('./config/db');
const cors = require('cors');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

const app = express();
connectDB();
app.use(express.json({}));

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));
app.use(cors());
app.use('/public', express.static('public'));
// @route  GET home/:name
// @desc   home page render
// @access private
app.get('/', (req, res) => {
  res.send('home');
});
// Set EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Use the routes
app.use('/api/anubhav/', require('./routes/blog/blogs'));
app.use('/api/anubhav/', require('./routes/feedbacks'));
app.use('/api/anubhav/', require('./routes/reqarticle'));
app.use('/api/anubhav/', require('./routes/writeArticle'));

app.use('/admin/', require('./routes/admin/controlCenter'));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Listening on port ${port}`));