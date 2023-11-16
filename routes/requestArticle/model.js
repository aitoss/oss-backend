const mongoose = require('mongoose');

const requestSchema = new mongoose.Schema({
  author: {
    name: {
      type: String,
      trim: true,
      required: [true, 'Please provide your Name'],
    },
    company: {
      type: String,
      trim: true,
      required: [true, 'Please provide your Company'],
    },
  },
  question: {
    type: String,
    trim: true,
    required: [true, 'Please provide your Question'],
  },
  createdAt: {
    type: Date,
    default: Date.now,
    trim: true,
  },
});

const Request = mongoose.model('Request', requestSchema);

module.exports = Request;
