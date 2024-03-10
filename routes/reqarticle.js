const express = require('express');
const router = express.Router();

const Reqarticle= require('../models/Reqarticle');

// @route  GET /api/anubhav/getreqarticle
// @desc   get getreqarticle
// @route POST /api/anubhav/reqarticle
// @desc   post rearticle
// @access public

router.get('/reqarticle', async (req, res, next) =>{
  try {
    const reqarticle= await Reqarticle.find();
    res.json(reqarticle);
  } catch (error) {
    console.log(error);
  }
});

// Frontend request expectation
// Header { Content-Type: application/json}
// {
//     "requesterName": "Harshal Patil",
//     "requesteeName": "Elon Musk",
//     "requesteeContact": "https://www.linkedin.com/in/to/",
//     "company": "Flipkart",
//     "note": "dev test remove later"
// }

router.post('/reqarticle', async (req, res, next) => {
  const { requesterName, requesteeName, requesteeContact, company, note } = req.body;
  const createReqarticle = new Reqarticle({
    requesterName,
    requesteeName,
    requesteeContact,
    company,
    note,
  });

  try {
    await createReqarticle.save();
    res.status(201).json({ message: 'Request created successfully', createReqarticle });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Server Error' });
  }
});


module.exports = router;
