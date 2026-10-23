import { assertEquals } from "@std/assert"
import { Effect, Exit, Fiber, Layer, Schema, Stream } from "effect"
import { HttpServer } from "effect/http"
import { RpcClient, RpcSerialization } from "effect/rpc"
import { Socket } from "effect/socket"
import { App } from "../app.ts"
import { Feature } from "../definition.tsx"
import { OverlayRpcs } from "../protocol/rpcs.ts"
import { HttpLive, RPC_PATH } from "./Http.ts"

const bar = Feature.make({
  label: "Bar",
  state: Schema.Struct({ text: Schema.String }),
  initial: { text: "hello" },
  view: () => null,
})

const app = new App().defineFeatures({ bar }).defineScenes({ main: { label: "Main", features: ["bar"] } })

const clientLayer = (url: string) =>
  RpcClient.layerProtocolSocket().pipe(
    Layer.provide(Socket.layerWebSocket(url)),
    Layer.provide(Socket.layerWebSocketConstructorGlobal),
    Layer.provide(RpcSerialization.layerJson),
  )

const makeClient = (url: string) =>
  Layer.build(clientLayer(url)).pipe(
    Effect.flatMap((context) => RpcClient.make(OverlayRpcs).pipe(Effect.provideContext(context))),
  )

Deno.test("state change from one client reaches another client over WebSocket", async () => {
  const program = Effect.gen(function* () {
    const server = yield* HttpServer.HttpServer
    const port = server.address._tag === "UnixPathAddress" ? 0 : server.address.port
    const url = `ws://127.0.0.1:${port}${RPC_PATH}`
    const operator = yield* makeClient(url)
    const viewer = yield* makeClient(url)

    const received = yield* viewer
      .SubscribeScene({ sceneId: "main" })
      .pipe(Stream.take(2), Stream.runCollect, Effect.forkScoped)
    yield* Effect.sleep("100 millis")
    yield* operator.ApplyNow({ sceneId: "main", changes: [{ featureId: "bar", state: { text: "world" } }] })
    const snapshots = yield* Fiber.join(received)

    assertEquals(
      snapshots.map((s) => s.features["bar"]),
      [
        { state: { text: "hello" }, rev: 0, forceEpoch: 0 },
        { state: { text: "world" }, rev: 1, forceEpoch: 0 },
      ],
    )

    const invalid = yield* Effect.exit(
      operator.ApplyNow({ sceneId: "main", changes: [{ featureId: "bar", state: { text: 42 } }] }),
    )
    assertEquals(Exit.isFailure(invalid), true)
    const missing = yield* Effect.flip(
      operator.ApplyNow({ sceneId: "main", changes: [{ featureId: "nope", state: {} }] }),
    )
    assertEquals(missing._tag, "FeatureNotInScene")
  })

  await Effect.runPromise(
    program.pipe(Effect.scoped, Effect.provide(HttpLive(app.definition, { host: "127.0.0.1", port: 0 }))),
  )
})
