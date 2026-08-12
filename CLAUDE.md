# Working in this repo

Read [ARCHITECTURE.md](./ARCHITECTURE.md) before writing code here. It defines
the layering and the conventions, and it is the source of truth — this file is
only the short version for agent-assisted work.

## The rules that matter most

- **`routes/` is HTTP, `services/` is logic, `models/` is data.** A service that
  references `req` or `res` is wrong, no matter how convenient it is.
- **No repository layer.** Mongoose models already fill that role; do not add
  pass-through repository files.
- **Every new env var goes in `.example-env` and the README table** in the same
  change.
- **Serverless constraints are real:** in-process state (`Map`, caches) is not
  shared between invocations, and long external calls can be killed mid-flight.
  Anything that writes an in-progress state to Mongo must timestamp it so a
  killed invocation can be retried.

## Before saying a change works

Run it. `npm run server`, then hit the actual endpoint with `curl` — including
the failure paths (bad id, missing config, upstream error), not just the happy
one. Lint what you touched with `npx eslint <files>`; the repo has pre-existing
`indent`/`max-len` violations, so the bar is **no new errors**, not zero.

There is no test suite (`npm test` is a stub) and no CI, so nothing catches a
mistake for you.

## Style

Match the file you are editing. Comments explain *why*, not *what*. Prefer early
returns over nesting. Extract a helper on the second use, not in anticipation of
one.
