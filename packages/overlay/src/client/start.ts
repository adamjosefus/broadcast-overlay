import { Deferred, Effect } from "effect"
import type { AppDefinition, StartOptions } from "../app.ts"
import { registeredApp } from "./registry.ts"

/** Browser counterpart of `server/start.ts`: only registers the app definition. */
export const start = (definition: AppDefinition, _options: StartOptions): Promise<void> =>
  Effect.runPromise(Deferred.succeed(registeredApp, definition)).then(() => undefined)
