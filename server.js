const express = require('express');
const connectDB = require('./config/db');
const cors = require('cors');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const status = require('express-status-monitor');

const rateLimit = require("express-rate-limit");
const swaggerUi = require('swagger-ui-express');
const swaggerDocs = require('./swaggerConfig');

require('dotenv').config();

// Apply rate limiting to all requests
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 500, // Limit each IP to 500 requests per minute (as student on collage wifi share the same public IP address)
  message: "Too many requests, please try again later.",
  headers: true,
});

const app = express();

connectDB();

app.use(express.json());
app.use(limiter);
app.use(
  cors({
    origin: '*',
  }),
);

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));
app.use('/public', express.static('public'));

// Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval'"
  );
  next();
});

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