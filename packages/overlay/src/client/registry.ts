import { Deferred } from "effect"
import type { AppDefinition } from "../app.ts"

/**
 * The user's app module and the client bootstrap are separate scripts; the app
 * definition is handed over through this deferred, regardless of their order.
 */
export const registeredApp = Deferred.makeUnsafe<AppDefinition>()
