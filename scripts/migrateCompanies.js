// One-time migration: extracts unique companies from articles, inserts them into the
// companies collection, and backfills companyId on each article.
// Run: node scripts/migrateCompanies.js
// Safe to re-run — duplicate normalizedNames are skipped via the unique index.

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Article = require('../models/Article');
const Company = require('../models/Company');
const normalizeCompanyName = require('../utils/normalizeCompanyName');

async function migrate() {
  await connectDB();
  console.log('Connected to DB');

  // Create anonymous company for articles with no valid company name
  let anonymous = await Company.findOne({ normalizedName: 'anonymous' });
  if (!anonymous) {
    anonymous = await Company.create({ name: 'Anonymous', normalizedName: 'anonymous', domain: null, logo: null, status: false });
    console.log('Created anonymous company');
  }

  // Step 1: extract unique companies from articles
  const articles = await Article.find({}, 'companyName companyDomainName');
  const seen = new Map();

  for (const article of articles) {
    if (!article.companyName) continue;
    const normalized = normalizeCompanyName(article.companyName);
    if (!normalized) continue;
    if (!seen.has(normalized)) {
      const rawDomain = article.companyDomainName || '';
      const domain = rawDomain.replace('https://logo.clearbit.com/', '').trim() || null;
      seen.set(normalized, { name: article.companyName.trim(), normalizedName: normalized, domain, logo: null, status: true });
    }
  }

  // Step 2: insert companies (skip if normalizedName already exists)
  let inserted = 0;
  for (const company of seen.values()) {
    try {
      await Company.create(company);
      inserted++;
    } catch (err) {
      if (err.code === 11000) continue; // already exists, skip
      throw err;
    }
  }
  console.log(`Inserted ${inserted} companies`);

  // Step 3: backfill companyId on articles
  let updated = 0;
  for (const article of articles) {
    const normalized = article.companyName ? normalizeCompanyName(article.companyName) : '';
    const company = normalized
      ? await Company.findOne({ normalizedName: normalized })
      : anonymous;
    if (company) {
      await Article.updateOne({ _id: article._id }, { $set: { companyId: company._id } });
      updated++;
    }
  }
  console.log(`Backfilled companyId on ${updated} articles`);

  await mongoose.disconnect();
  console.log('Done');
}

migrate().catch(err => { console.error(err); process.exit(1); });
