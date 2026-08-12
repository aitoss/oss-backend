# Architecture

How code is organised in this repo and where new code belongs. Read this before
your first PR.

The folder layout below already exists. What this document adds is the rule for
**what may live in each folder** — that part has been inconsistent, and this is
the direction we are moving in.

## The layers

```
request
   │
   ▼
routes/       transport   HTTP in, HTTP out
   │
   ▼
services/     domain      the actual rules and workflows
   │
   ▼
models/       data        mongoose schemas and queries
```

A layer may call the one below it. **A layer must never call the one above it.**

### `routes/` — the controller layer

Owns everything HTTP and nothing else:

- read `req.params`, `req.query`, `req.body`
- validate and authenticate (`verifySession()`, `requireAuth`)
- pick the status code and shape the response body
- catch errors and map them to a status

A route handler should read like a short summary of the request. If you are
writing a `for` loop, a `sha256`, or a third-party API call inside a route, it
belongs in a service.

### `services/` — the domain layer

Owns the rules. A service:

- takes and returns **plain values and documents**
- may call models, other services, and external APIs
- decides *what is true*, never *what the HTTP response is*

A service must never touch `req` or `res`. This is the rule that is easiest to
break and the most valuable to keep — see the worked example below.

### `models/` — the data layer

Mongoose schemas, plus any statics or virtuals that belong to one collection.

### `utils/` — genuinely generic helpers

Pure functions with no knowledge of this product's domain. `normalizeCompanyName`
qualifies. A function that knows what an "authentic article" is does not — that
is domain knowledge and belongs in a service.

Write a util when the *second* caller appears, not in anticipation of one.

### `middleware/`, `config/`, `scripts/`

Cross-cutting request handlers; connection and environment setup; one-off
operational tasks (backfills, migrations) that are not part of the running app.

## "Do we need a repository layer, like in Java?"

**No — and this is not us being sloppy.** It is a real difference between the two
stacks, not a Java-only idea we are skipping out of laziness.

In Spring, a JPA entity is a dumb data holder, so `@Repository` exists to give
queries a home. In Mongoose, the model **is** that home: `Article.findById(...)`,
statics, and query helpers are already an encapsulated data-access object. Adding
`repositories/ArticleRepository.js` that only forwards to `Article` buys nothing
and adds a file to keep in sync.

So the layering here is **routes → services → models**, with models playing the
repository role.

Add a repository-shaped module only when there is real pressure for one:

- the same non-trivial query or aggregation pipeline is duplicated across services
- a service needs to be unit-tested without a database
- one logical entity spans several collections and callers should not know that

In those cases put it in `services/` as a data-access module (for example
`services/articleQueries.js`). Introduce it because something hurt, not upfront.

## Worked example: the rule that is easiest to break

The article-summary feature originally shipped with this in a service:

```js
// services/summaryRouteLogic.js  — DON'T
async function getArticleOr404(articleId, res) {
  const article = await Article.findById(articleId);
  if (!article || !article.isAuthentic) {
    res.status(404).json({message: 'Article not found'});  // service writes HTTP
    return null;
  }
  return article;
}
```

It works, so it is worth being precise about why it is wrong:

- the service now owns a status code and a response body, so the routes no longer
  control their own contract
- callers depend on an invisible rule — "if this returns null, the response has
  already been sent, so return immediately". Forget the bare `return` and you get
  a double-send crash
- it cannot be called from anywhere that is not an HTTP request: no cron job, no
  backfill script, no test

The fix is to let it answer a question and let the route decide what that means:

```js
// services/summaryRouteLogic.js  — DO
async function findPublishedArticle(articleId) {
  if (!mongoose.Types.ObjectId.isValid(articleId)) return null;   // no CastError 500
  const article = await Article.findById(articleId).select(/* ... */);
  return article && article.isAuthentic ? article : null;
}
```

```js
// routes/blog/summary.js — the route owns the HTTP contract
const article = await findPublishedArticle(req.params.id);
if (!article) return res.status(404).json({message: 'Article not found'});
```

Same behaviour, but the service is now reusable and the route reads honestly.

## Conventions

**Naming.** Say what it is, not where it is called from. `summaryRouteLogic.js`
names its caller; `articleSummary.js` names its subject. Services are nouns or
verb phrases about the domain (`findPublishedArticle`, `buildSourceHash`), not
`handleX` or `doX`.

**Configuration.** Read `process.env` once at module load into a named constant
with a default, never inline at the call site. Add every new variable to
`.example-env` in the same PR — a variable that only exists in someone's local
`.env` is a broken deploy waiting to happen.

```js
const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS) || 20000;
```

**Errors.** Distinguish "the caller did something wrong" (4xx), "we are
misconfigured" (503), and "we broke" (500). Tag errors that need different
handling rather than matching on message text:

```js
error.code = 'CONFIG_ERROR';   // route maps this to 503, not 500
```

**Comments.** Explain *why*, never *what*. `// increment counter` is noise;
`// checked before any write so a bad deploy can't consume the retry budget`
is the reason someone needs six months from now.

**Logging.** Log identifiers and outcomes, not payloads. Never log full user
content or anything derived from a secret — hosted logs are durable and shared.

**Functions.** If a function needs a comment to explain its middle, that middle
usually wants to be its own function. Keep nesting shallow: validate and return
early rather than wrapping the body in `if`.

**Async.** Anything registered in a `Map` or otherwise cached must be released on
*every* exit path, including throws — attach cleanup with `.finally()` rather
than a `try/finally` that early returns can skip.

## Deployment constraints worth knowing

This app runs on Vercel as a serverless function, which has two consequences that
have already caused real bugs:

1. **In-process state is not shared.** A `Map` or in-memory cache is per-instance
   and disappears between invocations. It can be an optimisation, never a
   correctness guarantee — anything that must hold across requests goes in Mongo.
2. **Invocations are killed at the function duration limit.** If you write a
   "started" state to the database and then make a long external call, a kill
   leaves that row stranded with no terminal state. Always give such states a
   timestamp and treat a sufficiently old one as retryable.

## Working on existing code

Most of this repo predates this document; `routes/blog/blogs.js` in particular
holds routing, business logic, and queries in one file. That is expected and not
a bug to fix in one go.

The rule is **leave it better than you found it**:

- new features follow this structure from the start
- when you touch existing code, migrate the part you touched
- do not open a PR that only moves code around — refactor alongside a change
  someone actually wants, so it can be reviewed with its purpose visible

## PR checklist

- [ ] Route handlers contain no business logic
- [ ] Services do not reference `req` or `res`
- [ ] New env vars are in `.example-env`
- [ ] New shared behaviour is a named function, not a copy
- [ ] `npx eslint <changed files>` reports no new errors
- [ ] Tested locally against a real request, not just read through
