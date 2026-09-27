/**
 * Self-check for the role/year search filters. Run with:
 *   node scripts/checkArticleFilters.js
 *
 * Drives GET /blogs with a stubbed Article model, so it needs no database.
 */
const assert = require('assert');

const Article = require('../models/Article');

/**
 * Pulls one route's handler out of the blogs router.
 * @param {string} method http method, lower case
 * @param {string} path the route path as registered
 * @return {Function} the handler
 */
function handlerFor(method, path) {
  const router = require('../routes/blog/blogs');
  const layer = router.stack.find(
      (l) => l.route && l.route.path === path && l.route.methods[method]);
  assert.ok(layer, `no ${method} ${path} route`);
  const stack = layer.route.stack;
  return stack[stack.length - 1].handle;
}

/** Runs every check. */
async function main() {
  const handler = handlerFor('get', '/blogs');
  const realFind = Article.find;

  let seen = null;
  const chain = {
    sort: () => chain,
    skip: () => chain,
    limit: () => chain,
    populate: async () => [],
  };
  Article.find = (filter) => {
    seen = filter;
    return chain;
  };

  const res = {json: () => {}, status: () => res, send: () => {}};
  const run = async (query) => {
    seen = null;
    await handler({query}, res);
    return seen;
  };

  try {
    // No filters must leave the query exactly as it was.
    assert.deepStrictEqual(await run({}), {isAuthentic: true});

    // A role filter is an exact match on the enum, not a regex.
    assert.deepStrictEqual((await run({role: 'Internship'})).typeOfArticle,
        {$in: ['Internship']});

    // Several roles are a union.
    assert.deepStrictEqual((await run({role: 'Internship,FullTime'}))
        .typeOfArticle, {$in: ['Internship', 'FullTime']});

    // A year becomes a half-open range, so December 31st is still in it and
    // January 1st of the next year is not.
    const year = (await run({year: '2024'})).$or;
    assert.strictEqual(year.length, 1);
    assert.strictEqual(year[0].createdAt.$gte.toISOString(),
        '2024-01-01T00:00:00.000Z');
    assert.strictEqual(year[0].createdAt.$lt.toISOString(),
        '2025-01-01T00:00:00.000Z');

    // Junk years are dropped rather than turned into Invalid Date, which
    // would silently match nothing.
    assert.strictEqual((await run({year: 'last-tuesday'})).$or, undefined);

    // Both at once still filter on both.
    const both = await run({role: 'GSOC', year: '2023'});
    assert.deepStrictEqual(both.typeOfArticle, {$in: ['GSOC']});
    assert.strictEqual(both.$or.length, 1);
    assert.strictEqual(both.isAuthentic, true);
  } finally {
    Article.find = realFind;
  }

  console.log('article filter checks passed');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
