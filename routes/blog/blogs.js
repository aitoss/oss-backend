const express = require("express");
const router = express.Router();
const Article = require("../../models/Article");

// @route  GET /api/anubhav/blogs
// @desc   get all blogs
// @access public
router.get("/blogs", async (req, res) => {
  try {
    const blogs = await Article.find({}).sort({ createdAt: -1 });
    res.json(blogs);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// @route  GET /api/anubhav/blogs/:id
// @desc   get a single blog by its ID
// @access public
router.get("/blog/:index", async (req, res) => {
    try {
      const index = req.params.index;
  
      const blog = await Article.findById(index);
  
      res.json(blog);
    } catch (err) {
      console.error(err.message);
      res.status(500).send("Server Error");
    }
  });

module.exports = router;
