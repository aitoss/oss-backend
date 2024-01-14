const express = require("express");
const router = express.Router();
const Article = require("../models/Article");

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
router.get("/blogs/:index", async (req, res) => {
    try {
      const index = parseInt(req.params.index);
      
      if (isNaN(index)) {
        return res.status(400).json({ message: "Invalid index" });
      }
  
      const blog = await Article.find({}).skip(index).limit(1);
  
      if (blog.length === 0) {
        return res.status(404).json({ message: "Blog not found" });
      }
  
      res.json(blog[0]);
    } catch (err) {
      console.error(err.message);
      res.status(500).send("Server Error");
    }
  });

module.exports = router;
