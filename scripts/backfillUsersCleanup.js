// Cleanup migration: handles articles skipped by backfillUsers.js
// (those whose author.contact wasn't a valid email).
// Strategy:
//   - Spam (name === contact and neither is an email)        -> anonymous user
//   - Contact contains an embedded email                     -> extract & upsert user
//   - Real name with social URL contact                      -> slug(name)@gmail.com
//     (LinkedIn URLs go into user.linkedinUrl, others into user.contact)
// Run: node scripts/backfillUsersCleanup.js
// Safe to re-run: articles that already have authorId are skipped.

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Article = require('../models/Article');
const User = require('../models/User');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_EXTRACT = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
const LINKEDIN_RE = /linkedin\.com/i;

const ANONYMOUS_EMAIL = 'anonymous@anubhav.local';

const slugifyEmail = (name) => {
  const base = String(name || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
  if (!base) return null;
  return `${base}@gmail.com`;
};

const isSpam = (name, contact) => {
  const n = String(name || '').trim();
  const c = String(contact || '').trim();
  if (!n || !c) return false;
  if (n.toLowerCase() !== c.toLowerCase()) return false;
  return !EMAIL_REGEX.test(c);
};

async function getOrCreateAnonymous() {
  const existing = await User.findOne({ email: ANONYMOUS_EMAIL });
  if (existing) return existing;
  return User.create({ email: ANONYMOUS_EMAIL, name: 'Anonymous', status: 'inactive' });
}

async function upsertUser({ email, name, contact, linkedinUrl }) {
  const setOnInsert = { email, status: 'active' };
  if (name) setOnInsert.name = name;
  if (contact) setOnInsert.contact = contact;
  if (linkedinUrl) setOnInsert.linkedinUrl = linkedinUrl;
  await User.updateOne({ email }, { $setOnInsert: setOnInsert }, { upsert: true });
  return User.findOne({ email }, '_id');
}

async function migrate() {
  await connectDB();
  console.log('Connected to DB');

  const anonymous = await getOrCreateAnonymous();
  console.log(`Anonymous user: ${anonymous._id}`);

  const articles = await Article.find(
    { authorId: { $in: [null, undefined] } },
    '_id author authorId',
  );
  console.log(`Found ${articles.length} articles still missing authorId`);

  const stats = { spam: 0, extracted: 0, slugged: 0, skipped: 0 };
  const stillSkipped = [];

  for (const article of articles) {
    const rawContact = article.author && article.author.contact ? String(article.author.contact).trim() : '';
    const rawName = article.author && article.author.name ? String(article.author.name).trim() : '';

    // Already handled by main backfill — defensive guard.
    if (rawContact && EMAIL_REGEX.test(rawContact.toLowerCase())) continue;

    let userId = null;

    if (isSpam(rawName, rawContact)) {
      userId = anonymous._id;
      stats.spam++;
    } else {
      const m = rawContact.match(EMAIL_EXTRACT);
      if (m) {
        const email = m[1].toLowerCase();
        const linkedinUrl = LINKEDIN_RE.test(rawContact) ? rawContact : undefined;
        const user = await upsertUser({ email, name: rawName, linkedinUrl });
        userId = user._id;
        stats.extracted++;
      } else {
        const email = slugifyEmail(rawName);
        if (!email) {
          stillSkipped.push({ articleId: article._id.toString(), reason: 'no_usable_name', name: rawName, contact: rawContact });
          stats.skipped++;
          continue;
        }
        const linkedinUrl = LINKEDIN_RE.test(rawContact) ? rawContact : undefined;
        const contact = !linkedinUrl && rawContact ? rawContact : undefined;
        const user = await upsertUser({ email, name: rawName, contact, linkedinUrl });
        userId = user._id;
        stats.slugged++;
      }
    }

    await Article.updateOne({ _id: article._id }, { $set: { authorId: userId } });
  }

  console.log('\nResults:', stats);
  if (stillSkipped.length) {
    console.log(`\n⚠️  ${stillSkipped.length} articles still skipped:`);
    for (const s of stillSkipped) {
      console.log(`  - article=${s.articleId} reason=${s.reason} name="${s.name}" contact="${s.contact}"`);
    }
  }

  await mongoose.disconnect();
  console.log('Done');
}

migrate().catch(err => { console.error(err); process.exit(1); });
