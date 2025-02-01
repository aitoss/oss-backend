const express = require('express');

const router = express.Router();

const Feedback = require('../models/Feedback');


/**
 * @swagger
 * /api/anubhav/feedbacks:
 *   get:
 *     summary: Get all feedbacks
 *     tags: [Feedback]
 *     responses:
 *       200:
 *         description: List of all feedbacks sorted by creation date
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   feedback:
 *                     type: string
 *                   rating:
 *                     type: number
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *       500:
 *         description: Internal server error
 */

router.get('/feedbacks', async (req, res, next) => {
  try {
    const feedback = await Feedback.find({}).sort({createdAt: -1});
    res.json(feedback);
  } catch (error) {
    console.log(error);
  }
});


/**
 * @swagger
 * /api/anubhav/feedbacks:
 *   post:
 *     summary: Submit a new feedback
 *     tags: [Feedback]
 *     parameters:
 *       - in: body
 *         name: feedback
 *         description: Feedback details
 *         required: true
 *         schema:
 *           type: object
 *           properties:
 *             feedback:
 *               type: string
 *               description: Feedback content
 *             rating:
 *               type: number
 *               description: Rating given in feedback (1-5)
 *             createdAt:
 *               type: string
 *               format: date-time
 *               description: Feedback creation timestamp
 *     responses:
 *       201:
 *         description: Feedback submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 feedback:
 *                   type: string
 *                 rating:
 *                   type: number
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Bad request, missing or invalid data
 *       500:
 *         description: Internal server error
 */

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
