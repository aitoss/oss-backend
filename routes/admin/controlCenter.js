const express = require("express");
const { adminPasswordHash, adminEmail } = require("../../constants");
const requireAuth = require("../../middleware/requireAuth");
const Article = require("../../models/Article");
const bcrypt = require("bcrypt");
const fetch = require("node-fetch");
require("dotenv").config();

const router = express.Router();
const BACKEND_URL = 'https://oss-backend.vercel.app/api/anubhav'; // todo - to be put in env

// Login route
router.get("/login", (req, res) => {
  res.render("login");
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (
    email === adminEmail &&
    (await bcrypt.compare(password, adminPasswordHash))
  ) {
    req.session.isAuthenticated = true;
    res.redirect("/admin/home");
  } else {
    res.render("login", { error: "Invalid email or password" });
  }
});

router.get("/view-article/:id", requireAuth, async (req, res) => {
  try {
    const articleId = req.params.id;
    const article = await Article.findById(articleId);

    if (!article) {
      return res.status(404).send("Article not found");
    }

    res.render("view-article", { article });
  } catch (error) {
    console.error("Error fetching article:", error);
    res.redirect("/admin/home");
  }
});


router.post("/update-authentic/:id", requireAuth, async (req, res) => {
  try {
    const articleId = req.params.id;
    const article = await Article.findById(articleId);

    if (!article) {
      return res.status(404).send("Article not found");
    }

    // Toggle the isAuthentic status
    article.isAuthentic = !article.isAuthentic;
    await article.save();

    res.redirect("/admin/home");
  } catch (error) {
    console.error("Error updating article authenticity:", error);
    res.redirect("/admin/home");
  }
});

// Admin route
router.get("/home", requireAuth, async (req, res) => {
  try {
    // Adjust the URL to include query parameters if needed
    const response = await fetch(`http://localhost:3000/api/anubhav/blogs?useLatest=false&page=1`);
    
    // Check if the response is OK
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    // Parse the JSON response
    const data = await response.json();

    // Extract only the articles and hasMore
    const { articles, hasMore } = data;

    // Render the view with articles and hasMore
    res.render("admin", { articles, hasMore });
  } catch (error) {
    console.error("Error fetching articles:", error);
    res.render("admin", { articles: [], hasMore: false, error: "Failed to load articles" });
  }
});



// Logout route
router.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.redirect("/admin/home");
    }
    res.clearCookie("connect.sid");
    res.redirect("/admin/login");
  });
});

module.exports = router;
