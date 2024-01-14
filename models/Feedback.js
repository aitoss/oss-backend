const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  article: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Article',
    required: true,
  },
  feedback: {
    type: String,
    default: "",
  },
  rating: {
    type: Number,
    required: true,
  },
  creationDate: {
    type: Date,
    default: Date.now,
  },
});

const Feedback = mongoose.model('Feedback', feedbackSchema);

module.exports = Feedback;
