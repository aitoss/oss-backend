const express = require('express');

const router = express.Router();

const Feedback = require('../models/Feedback');

// @route  GET /api/anubhav/getfeedbacks
// @desc   get getfeedback
// @route POST /api/anubhav/feedbacks
// @desc   post feedback
// @access public

router.get('/feedbacks', async (req, res, next) => {
  try {
    const feedback = await Feedback.find({}).sort({createdAt: -1});
    res.json(feedback);
  } catch (error) {
    console.log(error);
  }
});

router.post('/feedbacks', async (req, res, next) => {
  const {feedback, rating, createdAt} = req.body;

  const createFeedback = new Feedback({
    feedback,
    rating,
    createdAt,
  });

  try {
    await createFeedback.save();
  } catch (error) {
    console.log(error);
  }
  res.status(201).json({createFeedback});
});

module.exports = router;
