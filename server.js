const express = require('express');
const { MongoClient } = require('mongodb');
const connectDB = require('./config/db');
const app = express();

require('dotenv').config();

const mongouri = process.env.MONGOURI;

async function connectToMongoDB() {
  const client = new MongoClient(mongouri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  try {
    await client.connect();
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
  }
}

connectToMongoDB();

app.set('view-engine', 'ejs');

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
app.use('/api/anubhav/', require('./routes/blog'));
app.use('/api/anubhav/', require('./routes/feedback'));
app.use('/api/anubhav/', require('./routes/companies'));
app.use('/api/anubhav/', require('./routes/requestArticle'));

const port = process.env.PORT || 3000;

app.listen(port, () => console.log(`Listening on port ${port}`));
