import { Schema } from "effect"

/** Identifier of a scene, as declared in `App.defineScenes`. */
export const SceneId = Schema.String
/** Identifier of a feature, as declared in `App.defineFeatures`. */
export const FeatureId = Schema.String

/**
 * State of one feature inside a scene. `state` is the feature's encoded value,
 * already validated by the server against the feature schema.
 *
 * - `rev` grows whenever `state` changes; clients reuse the previous object when
 *   it is unchanged, so references stay stable and no spurious transition runs.
 * - `forceEpoch` grows on every forced change (`setStateForce`).
 */
export const FeatureSlot = Schema.Struct({
  state: Schema.Unknown,
  rev: Schema.Int,
  forceEpoch: Schema.Int,
})
export type FeatureSlot = typeof FeatureSlot.Type

export const SceneSnapshot = Schema.Struct({
  sceneId: SceneId,
  /** Changes on every server start; revisions are only comparable within one server run. */
  serverId: Schema.String,
  revision: Schema.Int,
  features: Schema.Record(FeatureId, FeatureSlot),
})
export type SceneSnapshot = typeof SceneSnapshot.Type

/** A requested change of one feature's state (encoded, not yet validated). */
export const Change = Schema.Struct({
  featureId: FeatureId,
  state: Schema.Unknown,
})
export type Change = typeof Change.Type

export const FeatureInfo = Schema.Struct({
  id: FeatureId,
  label: Schema.String,
  description: Schema.optionalKey(Schema.String),
})
export type FeatureInfo = typeof FeatureInfo.Type

export const SceneInfo = Schema.Struct({
  id: SceneId,
  label: Schema.String,
  features: Schema.Array(FeatureInfo),
})
export type SceneInfo = typeof SceneInfo.Type
