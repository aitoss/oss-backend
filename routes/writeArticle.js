const express = require('express');
const router = express.Router();
const Article = require('../models/Article');

/**
 * @swagger
 * /api/anubhav/tags:
 *   get:
 *     summary: Get all tags used in articles for tag suggestions
 *     tags: [Content]
 *     responses:
 *       200:
 *         description: A list of tags used in articles, sorted by frequency
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                     description: Tag name
 *                   count:
 *                     type: integer
 *                     description: Number of articles using this tag
 *       500:
 *         description: Internal server error
 */

router.get('/tags', async (req, res) => {
  try {
    const tags = await Article.aggregate([
      {$unwind: '$articleTags'},
      {$group: {_id: '$articleTags', count: {$sum: 1}}},
      {$sort: {count: -1}},
    ]);

    res.json(tags);
  } catch (error) {
    console.error('Error fetching tags:', error);
    res.status(500).json({message: 'Internal server error'});
  }
});

/**
 * @swagger
 * /api/anubhav/companies:
 *   get:
 *     summary: Get all companies used in articles for company suggestions
 *     tags: [Content]
 *     responses:
 *       200:
 *         description: A list of companies used in articles
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: string
 *                 description: Company name
 *       500:
 *         description: Internal server error
 */

router.get('/companies', async (req, res) => {
  try {
    const companies = await Article.distinct('companyName');
    res.json(companies);
  } catch (error) {
    console.error('Error fetching companies:', error);
    res.status(500).json({message: 'Internal server error'});
  }
});

module.exports = router;
