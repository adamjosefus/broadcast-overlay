import { RouterProvider } from "@tanstack/react-router"
import { Deferred, Effect, Option } from "effect"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { AppProvider } from "./AppContext.tsx"
import { registeredApp } from "./registry.ts"
import { router } from "./router.tsx"

const program = Effect.gen(function* () {
  const definition = yield* Deferred.await(registeredApp)
  const container = yield* Effect.fromNullishOr(document.getElementById("root"))
  yield* Effect.sync(() => {
    document.title = definition.config.title ?? "Overlay"
    createRoot(container).render(
      <StrictMode>
        <AppProvider value={Option.some(definition)}>
          <RouterProvider router={router} />
        </AppProvider>
      </StrictMode>,
    )
  })
})

Effect.runFork(program)
