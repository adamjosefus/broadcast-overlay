import { NodeHttpServer } from "@effect/platform-node"
import { Layer } from "effect"
import { HttpRouter } from "effect/http"
import { RpcSerialization, RpcServer } from "effect/rpc"
import { createServer } from "node:http"
import type { AppDefinition } from "../app.ts"
import { OverlayRpcs } from "../protocol/rpcs.ts"
import { RpcHandlers } from "./RpcHandlers.ts"
import { SceneStore } from "./SceneStore.ts"

export const RPC_PATH = "/rpc"

/** HTTP server with the WebSocket RPC endpoint. Exposes `HttpServer` for its address. */
export const HttpLive = (
  definition: AppDefinition,
  options: { readonly host: string; readonly port: number },
) =>
  HttpRouter.serve(
    RpcServer.layer(OverlayRpcs).pipe(
      Layer.provide(RpcServer.layerProtocolWebsocket({ path: RPC_PATH })),
      Layer.provide(RpcHandlers),
    ),
    { disableLogger: true, disableListenLog: true },
  ).pipe(
    Layer.provide(SceneStore.layer(definition)),
    Layer.provide(RpcSerialization.layerJson),
    Layer.provideMerge(NodeHttpServer.layer(() => createServer(), options)),
  )
