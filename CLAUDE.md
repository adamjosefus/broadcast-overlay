# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`overlay` is a TypeScript library that starts a local web app for controlling OBS broadcast graphics
(Browser Source). Users register their own features, components and scenes through a typed API. The
design and its open questions are in `docs/ARCHITECTURE.md` (Czech).

pnpm monorepo, runtime Deno (must work on macOS, Linux and Windows: no platform paths or shell commands):

- `packages/overlay` – the library
- `apps/demo-show` – a sample project using it (dogfooding)

## Commands

Run from the repo root:

- `pnpm install` – install dependencies (pnpm manages `node_modules`; Deno uses them via `nodeModulesDir: "manual"`)
- `pnpm dev` – start the demo app on http://localhost:4000 (dashboard at `/scene/main`, OBS page at `/scene/main/broadcast`)
- `pnpm check` – type-check (`deno check`)
- `pnpm lint` – oxlint
- `pnpm fmt` / `pnpm fmt:check` – oxfmt
- `pnpm test` – all tests (`deno test -A`)
- single test: `deno test -A packages/overlay/src/core/scene.test.ts --filter "applyChanges"`

## Code rules

- Strict TS; no `as` casts (except `as const`), no `any`, no non-null `!` – enforced by oxlint.
- Data from outside (WebSocket, URL, persisted state) is validated with Effect Schema.
- Errors are tagged (`Schema.TaggedError`), never thrown. Side effects live in Effect.
- Effect 4 (`effect@4.0.6`): HTTP/RPC/socket modules are `effect/http`, `effect/rpc`, `effect/socket`.
  Its own docs ship in `node_modules/.pnpm/effect@4.0.6/node_modules/effect/{AGENTS.md,ai-docs}`.

## Architecture

- `src/app.ts`, `src/definition.tsx` – public API. `App` is an immutable builder (`defineFeatures` →
  `defineScenes`), so feature ids flow into scene types. `Feature.make` infers state types from the
  Effect Schema; each feature also carries type-erased ops (`erased`) used by the server and internal UI.
- `src/core` – pure domain: snapshot model, reducers (`applyChanges`, `forceFeature`), tagged errors.
- `src/protocol/rpcs.ts` – `@effect/rpc` group over WebSocket. Feature states travel as `Unknown`; the
  server validates them with the feature schema, clients decode them with the same schema.
- `src/server` – `SceneStore` (one `SubscriptionRef` per scene, source of truth), RPC handlers, an
  internal Node HTTP server on a random port, and a Vite dev server on the public port that proxies `/rpc`.
- `src/client` – React SPA (TanStack Router, code-based routes). The user's entry module (Deno main
  module by default) is loaded into the browser through `/overlay-entry`; `App.start()` there resolves to
  `client/start.ts`, which only registers the definition. Broadcast page loads no dashboard CSS.
- State contract: a feature/component starts a transition when `state` changes reference, and jumps
  immediately when `force.epoch` changes. References are kept stable by per-slot revisions on the client
  and by structural equality (`useStableReference`) at each feature/component boundary.
