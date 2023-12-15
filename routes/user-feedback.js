const express = require('express');

const router = express.Router();

const Feedback= require('../models/Feedback');

// @route  GET /api/anubhav/getfeedback
// @desc   get getfeedback 
// @route POST /api/anubhav/feedback
// @desc   post feedback
// @access public

router.get('/getfeedback', async (req, res, next) =>{
                try {
                    const feedback= await Feedback.find({}).sort({createdAt: -1});
                    res.json(feedback);
                } catch (error) {
                    console.log(error);
                }    
})

router.post('/feedback', async (req, res, next) =>{
          const {feedback, rating, createdAt} = req.body;

          const createFeedback = new Feedback({
                    feedback,
                    rating,
                    createdAt
          })

          try {
                await createFeedback.save();    
          } catch (error) {
                    console.log(error);
          }
          res.status(201).json({createFeedback})
})

module.exports = router;