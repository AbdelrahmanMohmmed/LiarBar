# shared/

**The wire contract between the server and the client.**

Every file here describes something that crosses the network. They are the
single source of truth, and they are **copied** into
`web/src/lib/generated/` by `npm run types:sync` (run from `server/`).

## Why copies rather than a shared package

Because both deployments build from a single directory and nothing else:

- The server's `Dockerfile` copies only `server/src`.
- Vercel builds the web app with `web/` as its root.

A cross-package import would work locally and fail in both deployments, in
ways that only surface at deploy time. Generating a committed copy keeps each
package buildable standalone — exactly as it is today — while still having one
place where the contract is defined.

`npm run types:check` fails if a copy has drifted, so editing the generated
file instead of this one is caught rather than silently accepted.

## Rules for files in this folder

1. **Types only, plus pure helpers.** No imports from `node:*`, no DOM types,
   no dependencies. These files are compiled by two different toolchains with
   two different libs.
2. **No imports from outside this folder.** The copy has no way to resolve them.
3. **Never edit the generated copy.** Edit here and run `npm run types:sync`.
