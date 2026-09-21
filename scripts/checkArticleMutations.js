/**
 * Self-check for the owner-only article rules. Run with:
 *   node scripts/checkArticleMutations.js
 *
 * Stubs Article.findById so it needs no database — what is under test is the
 * ownership boundary, not mongo.
 */
const assert = require('assert');

const Article = require('../models/Article');
const {loadOwnedArticle} = require('../services/articleMutations');

const OWNER = {_id: '507f1f77bcf86cd799439011'};
const STRANGER = {_id: '507f1f77bcf86cd799439012'};
const ARTICLE_ID = '507f191e810c19729de860ea';

const realFindById = Article.findById;

/**
 * Runs fn with Article.findById stubbed to resolve to `doc`.
 * @param {object|null} doc what findById should resolve to
 * @param {Function} fn the async body to run
 * @return {Promise<*>} whatever fn resolves or rejects with
 */
async function withArticle(doc, fn) {
  Article.findById = async () => doc;
  try {
    return await fn();
  } finally {
    Article.findById = realFindById;
  }
}

/**
 * Asserts that fn rejects with an ArticleMutationError of the given status.
 * @param {Function} fn the async body expected to throw
 * @param {number} status the HTTP status the error must carry
 */
async function expectStatus(fn, status) {
  try {
    await fn();
  } catch (error) {
    assert.strictEqual(error.status, status, `expected ${status}`);
    return;
  }
  throw new Error(`expected a ${status}, but the call resolved`);
}

/** Runs every check. */
async function main() {
  // A malformed id must read as "not found", never reach mongo.
  await expectStatus(() => loadOwnedArticle('not-an-object-id', OWNER), 404);

  // A missing (or soft-deleted, which the model hides) article is a 404.
  await withArticle(null, () =>
    expectStatus(() => loadOwnedArticle(ARTICLE_ID, OWNER), 404));

  // Someone else's article is a 403, not a 404 and not a silent success.
  await withArticle({_id: ARTICLE_ID, authorId: OWNER._id}, () =>
    expectStatus(() => loadOwnedArticle(ARTICLE_ID, STRANGER), 403));

  // An article with no author at all is nobody's to edit.
  await withArticle({_id: ARTICLE_ID, authorId: null}, () =>
    expectStatus(() => loadOwnedArticle(ARTICLE_ID, OWNER), 403));

  // The owner gets the document, even unapproved — that is the whole point
  // of the session-gated read.
  const mine = {_id: ARTICLE_ID, authorId: OWNER._id, isAuthentic: false};
  await withArticle(mine, async () => {
    assert.strictEqual(await loadOwnedArticle(ARTICLE_ID, OWNER), mine);
  });

  console.log('article mutation checks passed');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
