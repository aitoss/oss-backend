/**
 * Self-check for PUT /blogs/:id/reactions. Run with:
 *   node scripts/checkReactions.js
 *
 * Drives the real route handler with stubbed models and a fake res, so it
 * needs no database and no session server.
 */
const assert = require('assert');
const express = require('express');

const Article = require('../models/Article');
const User = require('../models/User');

const ARTICLE_ID = '507f191e810c19729de860ea';
const USER_ID = '507f1f77bcf86cd799439011';

/**
 * Pulls one route's handler out of the blogs router.
 * @param {string} method http method, lower case
 * @param {string} path the route path as registered
 * @return {Function} the handler registered after verifySession
 */
function handlerFor(method, path) {
  const router = require('../routes/blog/blogs');
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

  const realUserFindOne = User.findOne;
  const realUserUpdateOne = User.updateOne;
  const realArticleFindById = Article.findById;

  let lastUpdate = null;
  User.findOne = () => ({select: async () => ({_id: USER_ID})});
  User.updateOne = async (filter, update) => {
    lastUpdate = update;
  };
  Article.findById = () => ({
    select: () => ({lean: async () => ({_id: ARTICLE_ID})}),
  });

  const req = (body, id = ARTICLE_ID) => ({
    params: {id},
    body,
    session: {getUserId: () => 'st-user'},
  });

  try {
    // An unknown kind must be refused before anything is written.
    let res = fakeRes();
    lastUpdate = null;
    await handler(req({kind: 'subscribe', value: true}), res);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(lastUpdate, null, 'rejected kind still wrote');

    // A malformed article id is a 404, not a cast error.
    res = fakeRes();
    lastUpdate = null;
    await handler(req({kind: 'like', value: true}, 'not-an-id'), res);
    assert.strictEqual(res.statusCode, 404);
    assert.strictEqual(lastUpdate, null, 'bad id still wrote');

    // Liking adds to the set; the field must match the kind.
    res = fakeRes();
    await handler(req({kind: 'like', value: true}), res);
    assert.strictEqual(res.statusCode, 200);
    assert.deepStrictEqual(Object.keys(lastUpdate), ['$addToSet']);
    assert.ok('likedArticles' in lastUpdate.$addToSet);

    // Unliking pulls from the same field.
    res = fakeRes();
    await handler(req({kind: 'like', value: false}), res);
    assert.deepStrictEqual(Object.keys(lastUpdate), ['$pull']);
    assert.ok('likedArticles' in lastUpdate.$pull);

    // Saving writes the other field, never the likes.
    res = fakeRes();
    await handler(req({kind: 'save', value: true}), res);
    assert.ok('savedArticles' in lastUpdate.$addToSet);

    // A missing value is off rather than a crash.
    res = fakeRes();
    await handler(req({kind: 'save'}), res);
    assert.deepStrictEqual(Object.keys(lastUpdate), ['$pull']);

    // An article that does not exist must not grow the array.
    Article.findById = () => ({select: () => ({lean: async () => null})});
    res = fakeRes();
    lastUpdate = null;
    await handler(req({kind: 'like', value: true}), res);
    assert.strictEqual(res.statusCode, 404);
    assert.strictEqual(lastUpdate, null, 'missing article still wrote');
  } finally {
    User.findOne = realUserFindOne;
    User.updateOne = realUserUpdateOne;
    Article.findById = realArticleFindById;
  }

  assert.ok(express, 'express is required for the router to load');
  console.log('reaction checks passed');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
