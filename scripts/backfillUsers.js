// One-time migration: extract distinct (name, email) authors from articles,
// insert them into the users collection as orphans (no supertokensUserId),
// and backfill authorId on each article.
// Run: node scripts/backfillUsers.js
// Safe to re-run — duplicate emails are skipped via the unique index.

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Article = require('../models/Article');
const User = require('../models/User');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function migrate() {
  await connectDB();
  console.log('Connected to DB');

  const articles = await Article.find({}, '_id author authorId');
  console.log(`Scanning ${articles.length} articles…`);

  const skipped = []; // { articleId, reason, name, contact }
  const seen = new Map(); // email -> { name, email }

  for (const article of articles) {
    if (article.authorId) continue; // already linked

    const rawContact = article.author && article.author.contact ? String(article.author.contact).trim() : '';
    const rawName = article.author && article.author.name ? String(article.author.name).trim() : '';
    const email = rawContact.toLowerCase();

    if (!email) {
      skipped.push({ articleId: article._id.toString(), reason: 'empty_contact', name: rawName, contact: rawContact });
      continue;
    }
    if (!EMAIL_REGEX.test(email)) {
      skipped.push({ articleId: article._id.toString(), reason: 'not_an_email', name: rawName, contact: rawContact });
      continue;
    }

    if (!seen.has(email)) {
      seen.set(email, { email, name: rawName });
    }
  }

  // Step 1: insert orphan users (skip if email already exists)
  let inserted = 0;
  const upsertErrors = [];
  for (const u of seen.values()) {
    try {
      await User.updateOne(
        { email: u.email },
        { $setOnInsert: { email: u.email, name: u.name, status: 'active' } },
        { upsert: true },
      );
      inserted++;
    } catch (err) {
      upsertErrors.push({ email: u.email, name: u.name, code: err.code, message: err.message });
      if (err.code === 11000) continue;
      throw err;
    }
  }
  console.log(`Upserted ${inserted} users`);
  if (upsertErrors.length) {
    console.log(`\n⚠️  ${upsertErrors.length} upsert errors:`);
    for (const e of upsertErrors) {
      console.log(`  - email="${e.email}" name="${e.name}" code=${e.code} message=${e.message}`);
    }
  }

  // Step 2: backfill authorId on articles
  let updated = 0;
  for (const article of articles) {
    if (article.authorId) continue;
    const rawContact = article.author && article.author.contact ? String(article.author.contact).trim() : '';
    const email = rawContact.toLowerCase();
    if (!email || !EMAIL_REGEX.test(email)) continue;
    const user = await User.findOne({ email }, '_id');
    if (user) {
      await Article.updateOne({ _id: article._id }, { $set: { authorId: user._id } });
      updated++;
    }
  }
  console.log(`Backfilled authorId on ${updated} articles`);

  if (skipped.length) {
    console.log(`\n⚠️  Skipped ${skipped.length} articles (no usable email):`);
    for (const s of skipped) {
      console.log(`  - article=${s.articleId} reason=${s.reason} name="${s.name}" contact="${s.contact}"`);
    }
  } else {
    console.log('\nNo articles skipped.');
  }

  await mongoose.disconnect();
  console.log('Done');
}

migrate().catch(err => { console.error(err); process.exit(1); });
