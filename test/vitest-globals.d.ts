/**
 * `vitest.config.ts` sets `globals: true`, so the tests call `describe`, `it`,
 * `expect` and `vi` without importing them — but TypeScript had no way to know
 * that, and reported every one of them as an undefined name. Around 130 phantom
 * errors, which is enough noise to bury a real one (it did: a schema change that
 * broke seven fixtures was invisible under them).
 *
 * A reference file rather than `"types"` in tsconfig.json: setting that key
 * switches off automatic `@types` discovery for the whole project, which would
 * take Node's and React's typings down with it.
 */
/// <reference types="vitest/globals" />
