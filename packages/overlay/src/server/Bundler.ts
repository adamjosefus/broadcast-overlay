import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { Effect, Layer, Schema } from "effect"
import { HttpServer } from "effect/http"
import { dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createServer, normalizePath, type Plugin, searchForWorkspaceRoot } from "vite"
import { RPC_PATH } from "./Http.ts"

export class BundlerError extends Schema.TaggedError<BundlerError>()("BundlerError", {
  message: Schema.String,
  cause: Schema.Defect(),
}) {}

const fromHere = (relative: string) => normalizePath(fileURLToPath(new URL(relative, import.meta.url)))

const clientRoot = fromHere("../client")
const packageRoot = fromHere("../..")
const appModule = fromHere("../app.ts")
const clientStart = fromHere("../client/start.ts")

/** Script of `client/index.html` that loads the user's app module. */
const ENTRY_ID = "/overlay-entry"
const RESOLVED_ENTRY_ID = "\0overlay-entry"

/**
 * - `/overlay-entry` imports the user's app module into the browser bundle.
 * - The server implementation of `App.start` is swapped for the browser one,
 *   which only registers the app definition.
 */
const overlayPlugin = (entry: string): Plugin => ({
  name: "overlay",
  enforce: "pre",
  resolveId(source, importer) {
    if (source === ENTRY_ID) {
      return RESOLVED_ENTRY_ID
    }
    if (source === "./server/start.ts" && importer !== undefined && normalizePath(importer) === appModule) {
      return clientStart
    }
    return undefined
  },
  load(id) {
    return id === RESOLVED_ENTRY_ID ? `import ${JSON.stringify(entry)}\n` : undefined
  },
})

export interface BundlerOptions {
  /** Absolute path of the user's app module. */
  readonly entry: string
  readonly host: string
  readonly port: number
}

/** Vite dev server for all views; proxies the RPC WebSocket to the internal HTTP server. */
export const BundlerLive = (options: BundlerOptions) =>
  Layer.effectDiscard(
    Effect.gen(function* () {
      const server = yield* HttpServer.HttpServer
      const rpcPort = server.address._tag === "UnixPathAddress" ? 0 : server.address.port
      const entry = normalizePath(options.entry)
      yield* Effect.acquireRelease(
        Effect.tryPromise({
          try: async () => {
            const vite = await createServer({
              configFile: false,
              root: clientRoot,
              appType: "spa",
              clearScreen: false,
              plugins: [overlayPlugin(entry), react(), tailwindcss()],
              resolve: { dedupe: ["react", "react-dom", "effect"] },
              server: {
                host: options.host,
                port: options.port,
                strictPort: true,
                proxy: { [RPC_PATH]: { target: `ws://127.0.0.1:${rpcPort}`, ws: true } },
                fs: { allow: [packageRoot, searchForWorkspaceRoot(dirname(entry))] },
              },
            })
            return vite.listen()
          },
          catch: (cause) => new BundlerError({ message: "Failed to start the Vite dev server", cause }),
        }),
        (vite) => Effect.promise(() => vite.close()),
      )
    }),
  )
