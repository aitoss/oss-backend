const express = require("express");
const { adminPasswordHash, adminEmail } = require("../../constants");
const requireAuth = require("../../middleware/requireAuth");
const Article = require("../../models/Article");
const Reqarticle = require("../../models/Reqarticle"); // Import the Reqarticle model
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
    const response = await fetch(`${BACKEND_URL}/articles?useLatest=false&page=1`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();

    const { articles, hasMore } = data;

    res.render("admin", { articles, hasMore });
  } catch (error) {
    console.error("Error fetching articles:", error);
    res.render("admin", { articles: [], hasMore: false, error: "Failed to load articles" });
  }
});

// Get requestArticle route
router.get("/reqArticle", requireAuth, async (req, res) => {
  const useLatest = req.query.useLatest || 'false';
  const page = req.query.page || '1';
  try {
    const response = await fetch(`${BACKEND_URL}/reqarticle?useLatest=${useLatest}&page=${page}`);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const reqarticle = await response.json();

    res.render("reqarticle", { reqarticle });
  } catch (error) {
    console.error("Error fetching request articles:", error);
    res.render("reqarticle", { reqarticle: [], error: "Failed to load request articles" });
  }
});

// DELETE request to remove a specific request article by ID
router.delete("/reqArticle/:id", requireAuth, async (req, res) => {
  try {
    const reqArticleId = req.params.id;
    const reqarticle = await Reqarticle.findById(reqArticleId);

    if (!reqarticle) {
      return res.status(404).json({ message: 'Request article not found' });
    }

    await reqarticle.remove();
    res.status(200).json({ message: 'Request article deleted successfully' });
  } catch (error) {
    console.error("Error deleting request article:", error);
    res.status(500).json({ message: 'Failed to delete request article', error });
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
