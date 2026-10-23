import { Context, Effect, Layer, ManagedRuntime } from "effect"
import { RpcClient, type RpcClientError, type RpcGroup, RpcSerialization } from "effect/rpc"
import { Socket } from "effect/socket"
import { OverlayRpcs } from "../protocol/rpcs.ts"

const rpcUrl = () => {
  const protocol = globalThis.location.protocol === "https:" ? "wss:" : "ws:"
  return `${protocol}//${globalThis.location.host}/rpc`
}

export class OverlayClient extends Context.Service<
  OverlayClient,
  RpcClient.RpcClient<RpcGroup.Rpcs<typeof OverlayRpcs>, RpcClientError.RpcClientError>
>()("overlay/client/OverlayClient") {
  static readonly layer = Layer.effect(OverlayClient, RpcClient.make(OverlayRpcs)).pipe(
    Layer.provide(RpcClient.layerProtocolSocket({ retryTransientErrors: true, pingInterval: "2 seconds" })),
    Layer.provide(Socket.layerWebSocket(Effect.sync(rpcUrl))),
    Layer.provide(Socket.layerWebSocketConstructorGlobal),
    Layer.provide(RpcSerialization.layerJson),
  )
}

/** Single runtime shared by all views of one browser tab. */
export const runtime = ManagedRuntime.make(OverlayClient.layer)
