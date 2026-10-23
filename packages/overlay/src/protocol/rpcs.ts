import { Schema } from "effect"
import { Rpc, RpcGroup } from "effect/rpc"
import { SceneCommandError, SceneNotFound } from "../core/errors.ts"
import { Change, FeatureId, SceneId, SceneInfo, SceneSnapshot } from "../core/model.ts"

/**
 * WebSocket protocol between the server (source of truth) and all clients.
 *
 * Feature states travel as `Unknown` on the wire; the server validates each one
 * against the schema of its feature, the client decodes it with the same schema.
 */
export class OverlayRpcs extends RpcGroup.make(
  Rpc.make("ListScenes", { success: Schema.Array(SceneInfo) }),
  Rpc.make("SubscribeScene", {
    payload: { sceneId: SceneId },
    success: SceneSnapshot,
    error: SceneNotFound,
    stream: true,
  }),
  Rpc.make("ApplyNow", {
    payload: { sceneId: SceneId, changes: Schema.Array(Change) },
    error: SceneCommandError,
  }),
  Rpc.make("Force", {
    payload: { sceneId: SceneId, featureId: FeatureId, state: Schema.optionalKey(Schema.Unknown) },
    error: SceneCommandError,
  }),
) {}
