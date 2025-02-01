const express = require('express');
const router = express.Router();

const Reqarticle = require('../models/Reqarticle');


/**
 * @swagger
 * /api/anubhav/reqarticle:
 *   get:
 *     summary: Get all request articles
 *     tags: [Reqarticle]
 *     responses:
 *       200:
 *         description: List of all request articles
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   requesterName:
 *                     type: string
 *                   requesteeName:
 *                     type: string
 *                   requesteeContact:
 *                     type: string
 *                   company:
 *                     type: string
 *                   note:
 *                     type: string
 *       500:
 *         description: Internal server error
 */

router.get('/reqarticle', async (req, res, next) => {
  try {
    const reqarticle = await Reqarticle.find();
    res.json(reqarticle);
  } catch (error) {
    console.log(error);
  }
});


/**
 * @swagger
 * /api/anubhav/reqarticle:
 *   post:
 *     summary: Submit a new request article
 *     tags: [Reqarticle]
 *     parameters:
 *       - in: body
 *         name: reqarticle
 *         description: Request article details
 *         required: true
 *         schema:
 *           type: object
 *           properties:
 *             requesterName:
 *               type: string
 *               description: Name of the requester
 *             requesterEmailId:
 *               type: string
 *               description: Email ID of the requester
 *             requesteeName:
 *               type: string
 *               description: Name of the requestee
 *             requesteeContact:
 *               type: string
 *               description: Contact details of the requestee
 *             company:
 *               type: string
 *               description: Company associated with the request
 *             note:
 *               type: string
 *               description: Additional note or comment
 *     responses:
 *       201:
 *         description: Request article submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 createReqarticle:
 *                   type: object
 *                   properties:
 *                     requesterName:
 *                       type: string
 *                     requesterEmailId:
 *                       type: string
 *                     requesteeName:
 *                       type: string
 *                     requesteeContact:
 *                       type: string
 *                     company:
 *                       type: string
 *                     note:
 *                       type: string
 *       400:
 *         description: Bad request, invalid data
 *       500:
 *         description: Internal server error
 */

router.post('/reqarticle', async (req, res, next) => {
  const {
    requesterName,
    requesteeName,
    requesteeContact,
    company,
    note,
    requesterEmailId,
  } = req.body;
  const createReqarticle = new Reqarticle({
    requesterName,
    requesterEmailId,
    requesteeName,
    requesteeContact,
    company,
    note,
  });

  try {
    await createReqarticle.save();
    res
        .status(201)
        .json({message: 'Request created successfully', createReqarticle});
  } catch (error) {
    console.log(error);
    res.status(500).json({message: 'Server Error', error});
  }
});

module.exports = router;
