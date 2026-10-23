import { NodeRuntime } from "@effect/platform-node"
import { Effect, Layer } from "effect"
import { networkInterfaces } from "node:os"
import { isAbsolute, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import type { AppDefinition, StartOptions } from "../app.ts"
import { BundlerLive } from "./Bundler.ts"
import { HttpLive } from "./Http.ts"

const DEFAULT_PORT = 4000
const DEFAULT_HOST = "0.0.0.0"

const toPath = (entry: string | URL): string =>
  entry instanceof URL || entry.startsWith("file:")
    ? fileURLToPath(entry)
    : isAbsolute(entry)
      ? entry
      : resolve(entry)

const lanAddresses = (): ReadonlyArray<string> =>
  Object.values(networkInterfaces())
    .flatMap((addresses) => addresses ?? [])
    .filter((address) => address.family === "IPv4" && !address.internal)
    .map((address) => address.address)

const logUrls = (definition: AppDefinition, port: number) =>
  Effect.gen(function* () {
    const hosts = ["localhost", ...lanAddresses()]
    yield* Effect.logInfo(`Overlay is running: ${hosts.map((host) => `http://${host}:${port}`).join(" ")}`)
    for (const sceneId of Object.keys(definition.scenes)) {
      yield* Effect.logInfo(
        `Scene "${sceneId}" broadcast (OBS): http://localhost:${port}/scene/${sceneId}/broadcast`,
      )
    }
  })

export const serverLayer = (definition: AppDefinition, options: StartOptions) => {
  const port = definition.config.server?.port ?? DEFAULT_PORT
  const host = definition.config.server?.host ?? DEFAULT_HOST
  const entry = toPath(options.entry ?? Deno.mainModule)
  return Layer.effectDiscard(logUrls(definition, port)).pipe(
    Layer.provideMerge(BundlerLive({ entry, host, port })),
    Layer.provide(HttpLive(definition, { host: "127.0.0.1", port: 0 })),
  )
}

/** Runs the server until the process is interrupted (Ctrl+C). */
export const start = (definition: AppDefinition, options: StartOptions): Promise<void> =>
  new Promise((done) => {
    NodeRuntime.runMain(
      Layer.launch(serverLayer(definition, options)).pipe(Effect.ensuring(Effect.sync(done))),
    )
  })
