// Creating express Router
const express=require("express")
const router=express.Router()

const Article = require('../models/Article');

// @route  GET /api/anubhav/blogs
// @desc   get blogs 
// @access public
router.get('/blogs', async (req, res) => {
    try {
        const blogs = await Article.find({}).sort({ createdAt: -1 });
        res.json(blogs);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports=router