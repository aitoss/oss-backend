const express = require('express');
const router = express.Router();
const Article = require('../models/Article');

// gets all the tags used in the articles, so users can get tags suggestions
router.get('/tags', async (req, res) => {
    try {
        const tags = await Article.aggregate([
            { $unwind: '$articleTags' },
            { $group: { _id: '$articleTags', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        res.json(tags);
    } catch (error) {
        console.error('Error fetching tags:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// gets all the tags used in the articles, so users can get tags suggestions
router.get('/companies', async (req, res) => {
    try {
        const { query } = req.query;

        let companies;

        if (query) {
            // If a query is provided, filter companies based on the query
            companies = await Article.distinct('companyName', {
                companyName: { $regex: new RegExp(query, 'i') }
            });
        } else {
            // If no query is provided, fetch all distinct companies
            companies = await Article.distinct('companyName');
        }

        res.json(companies);
    } catch (error) {
        console.error('Error fetching companies:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});


module.exports = router;

