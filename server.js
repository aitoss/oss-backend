const express = require('express');
const connectDB = require('./config/db');
const cors = require('cors');
const session = require('express-session');
const { MongoStore } = require('connect-mongo');
const bodyParser = require('body-parser');
const path = require('path');
const status = require('express-status-monitor');

const rateLimit = require("express-rate-limit");
const swaggerUi = require('swagger-ui-express');
const swaggerDocs = require('./swaggerConfig');
const { allowedOrigins } = require('./constants');
const supertokens = require("supertokens-node");
const { middleware, errorHandler } = require("supertokens-node/framework/express");
const EmailPassword = require("supertokens-node/recipe/emailpassword");
const Session = require("supertokens-node/recipe/session");

require('dotenv').config();
require('./supertoken-config');

// Apply rate limiting to all requests
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 500, // Limit each IP to 500 requests per minute (as student on collage wifi share the same public IP address)
  message: "Too many requests, please try again later.",
  headers: true,
});

const app = express();

connectDB();

// Blog posts inline the banner image as a base64 data URI, which base64 inflates by 4/3
// (a 73KB image becomes ~98KB), overshooting body-parser's 100kb default on its own.
app.use(express.json({ limit: '5mb' }));
app.set('trust proxy', 1); // Makes vercel work with express-rate-limit
app.use(limiter);


const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Not allowed by CORS: ${origin}`));
    }
  },
  credentials: true,
  allowedHeaders: ["content-type", ...supertokens.getAllCORSHeaders()],
};

app.use('/api', cors(corsOptions));
app.use('/auth', cors(corsOptions));
app.use(middleware());
app.use(errorHandler());

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
// express-session is scoped to /admin only — global mounting collides with SuperTokens' req.session.
const adminSession = session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGOURI }),
  cookie: { secure: process.env.NODE_ENV === 'prod', maxAge: 1000 * 60 * 60 * 24 }
});
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
  res.json({
    payload: "Welcome to Anubhav API",
    success: true
  })
});

// Set EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Use the routes
app.use('/api/anubhav/', require('./routes/blog/blogs'));
app.use('/api/anubhav/', require('./routes/feedbacks'));
app.use('/api/anubhav/', require('./routes/reqarticle'));
app.use('/api/anubhav/', require('./routes/writeArticle'));

app.use('/admin/', adminSession, require('./routes/admin/controlCenter'));

module.exports = app;
