const feedbackModel = require('./model');

// @route  GET /api/anubhav/feedback
// @desc   Get feedback
// @access Public
exports.getFeedback = async (req, res) => {
  try {
    const feedback = await feedbackModel.getFeedback();
    res.json(feedback);
  } catch (error) {
    console.error('Error fetching feedback:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
