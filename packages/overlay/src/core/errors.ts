import { Schema } from "effect"

export class SceneNotFound extends Schema.TaggedError<SceneNotFound>()("SceneNotFound", {
  sceneId: Schema.String,
}) {}

export class FeatureNotInScene extends Schema.TaggedError<FeatureNotInScene>()("FeatureNotInScene", {
  sceneId: Schema.String,
  featureId: Schema.String,
}) {}

export class InvalidFeatureState extends Schema.TaggedError<InvalidFeatureState>()("InvalidFeatureState", {
  featureId: Schema.String,
  message: Schema.String,
}) {}

export const SceneCommandError = Schema.Union([SceneNotFound, FeatureNotInScene, InvalidFeatureState])
export type SceneCommandError = typeof SceneCommandError.Type
