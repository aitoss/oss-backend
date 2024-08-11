const express = require("express");
const { adminPasswordHash, adminEmail } = require("../../constants");
const requireAuth = require("../../middleware/requireAuth");
const bcrypt = require("bcrypt");

const router = express.Router();

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

// Admin route
router.get("/home", requireAuth, (req, res) => {
  res.render("admin");
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
