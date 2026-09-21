/**
 * Self-check for PUT /blogs/:id/reactions. Run with:
 *   node scripts/checkReactions.js
 *
 * Drives the real route handler with stubbed models and a fake res, so it
 * needs no database and no session server.
 */
const assert = require('assert');

const Article = require('../models/Article');
const Interaction = require('../models/Interaction');
const User = require('../models/User');

const ARTICLE_ID = '507f191e810c19729de860ea';
const USER_ID = '507f1f77bcf86cd799439011';

/**
 * Pulls one route's handler out of the reactions router.
 * @param {string} method http method, lower case
 * @param {string} path the route path as registered
 * @return {Function} the handler registered after verifySession
 */
function handlerFor(method, path) {
  const router = require('../routes/blog/reactions');
  const layer = router.stack.find(
      (l) => l.route && l.route.path === path && l.route.methods[method]);
  assert.ok(layer, `no ${method} ${path} route`);
  const stack = layer.route.stack;
  return stack[stack.length - 1].handle;
}

/**
 * Minimal res double that records what the handler answered.
 * @return {object} the fake response
 */
function fakeRes() {
  const res = {statusCode: 200, body: undefined};
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (payload) => {
    res.body = payload;
    return res;
  };
  return res;
}

/** Runs every check. */
async function main() {
  const handler = handlerFor('put', '/blogs/:id/reactions');

  const real = {
    userFindOne: User.findOne,
    articleFindById: Article.findById,
    updateOne: Interaction.updateOne,
    deleteOne: Interaction.deleteOne,
  };

  let wrote = null;
  User.findOne = () => ({select: () => ({lean: async () => ({_id: USER_ID})})});
  Article.findById = () => ({
    select: () => ({lean: async () => ({_id: ARTICLE_ID})}),
  });
  Interaction.updateOne = async (filter, update, options) => {
    wrote = {op: 'upsert', filter, update, options};
  };
  Interaction.deleteOne = async (filter) => {
    wrote = {op: 'delete', filter};
  };

  const req = (body, id = ARTICLE_ID) => ({
    params: {id},
    body,
    session: {getUserId: () => 'st-user'},
  });

  try {
    // An unknown kind must be refused before anything is written.
    let res = fakeRes();
    wrote = null;
    await handler(req({kind: 'subscribe', value: true}), res);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(wrote, null, 'rejected kind still wrote');

    // A malformed article id is a 404, not a cast error.
    res = fakeRes();
    wrote = null;
    await handler(req({kind: 'like', value: true}, 'not-an-id'), res);
    assert.strictEqual(res.statusCode, 404);
    assert.strictEqual(wrote, null, 'bad id still wrote');

    // Liking upserts one row keyed by article, user and kind.
    res = fakeRes();
    await handler(req({kind: 'like', value: true}), res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(wrote.op, 'upsert');
    assert.strictEqual(wrote.options.upsert, true);
    assert.deepStrictEqual(wrote.filter._id,
        {a: ARTICLE_ID, u: USER_ID, k: 'like'});

    // A second like must not fail or duplicate: $setOnInsert leaves `at` be.
    assert.ok(wrote.update.$setOnInsert, 'repeat like would overwrite `at`');

    // Unliking removes that same row.
    res = fakeRes();
    await handler(req({kind: 'like', value: false}), res);
    assert.strictEqual(wrote.op, 'delete');
    assert.strictEqual(wrote.filter._id.k, 'like');

    // Saving writes its own row rather than touching the like.
    res = fakeRes();
    await handler(req({kind: 'save', value: true}), res);
    assert.strictEqual(wrote.filter._id.k, 'save');

    // A missing value is off rather than a crash.
    res = fakeRes();
    await handler(req({kind: 'save'}), res);
    assert.strictEqual(wrote.op, 'delete');

    // An article that does not exist must not be reacted to.
    Article.findById = () => ({select: () => ({lean: async () => null})});
    res = fakeRes();
    wrote = null;
    await handler(req({kind: 'like', value: true}), res);
    assert.strictEqual(res.statusCode, 404);
    assert.strictEqual(wrote, null, 'missing article still wrote');
  } finally {
    User.findOne = real.userFindOne;
    Article.findById = real.articleFindById;
    Interaction.updateOne = real.updateOne;
    Interaction.deleteOne = real.deleteOne;
  }

  console.log('reaction checks passed');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
