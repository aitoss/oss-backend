const express = require('express');
const connectDB = require('./config/db');
const cors = require('cors');
const session = require('express-session');
const bodyParser = require('body-parser');
const app = express();
const path = require('path');

connectDB();

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Use true in production with HTTPS
}));

app.use(cors());
app.use(express.json({}));
// app.use(express.urlencoded({extended: false}));
app.use('/public', express.static('public'));

// Set EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));


// @route  GET home/:name
// @desc   home page render
// @access private
app.get('/', (req, res) => {
  res.send('home');
});

// Routes
// TODO: move anubhav apis to /routes/api/..
app.use('/api/anubhav/', require('./routes/blog/blogs'));
app.use('/api/anubhav/', require('./routes/feedbacks'));
app.use('/api/anubhav/', require('./routes/reqarticle'));
app.use('/api/anubhav/', require('./routes/writeArticle'));

app.use('/admin/', require('./routes/admin/controlCenter'))

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Listening on port ${port}`));
