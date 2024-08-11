const express = require("express");
const { adminPasswordHash, adminEmail } = require("../../constants");
const requireAuth = require("../../middleware/requireAuth");
const Article = require("../../models/Article");
const bcrypt = require("bcrypt");
const fetch = require("node-fetch");
require("dotenv").config();

const router = express.Router();
const BACKEND_URL = 'http://localhost:3000/api/anubhav';

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
    // const useLatest = false;
    const response = await fetch(`${BACKEND_URL}/blogs`);
    const articles = await response.json();
    // console.log(articles);
    res.render("admin", { articles });
  } catch (error) {
    console.error("Error fetching articles:", error);
    res.render("admin", { articles: [], error: "Failed to load articles" });
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
