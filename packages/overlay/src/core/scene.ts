import { Option, Record, Result } from "effect"
import { FeatureNotInScene } from "./errors.ts"
import type { FeatureSlot, SceneSnapshot } from "./model.ts"

/** A validated change: `state` is already normalized by the feature schema. */
export interface ValidChange {
  readonly featureId: string
  readonly state: unknown
}

export const makeScene = (
  sceneId: string,
  serverId: string,
  initialStates: Readonly<Record<string, unknown>>,
): SceneSnapshot => ({
  sceneId,
  serverId,
  revision: 0,
  features: Record.map(initialStates, (state) => ({ state, rev: 0, forceEpoch: 0 })),
})

const getSlot = (scene: SceneSnapshot, featureId: string): Result.Result<FeatureSlot, FeatureNotInScene> =>
  Option.match(Record.get(scene.features, featureId), {
    onNone: () => Result.fail(new FeatureNotInScene({ sceneId: scene.sceneId, featureId })),
    onSome: Result.succeed,
  })

const setSlot = (scene: SceneSnapshot, featureId: string, slot: FeatureSlot): SceneSnapshot => ({
  ...scene,
  features: { ...scene.features, [featureId]: slot },
})

/** Applies all changes at once (one scene revision). */
export const applyChanges = (
  scene: SceneSnapshot,
  changes: ReadonlyArray<ValidChange>,
): Result.Result<SceneSnapshot, FeatureNotInScene> =>
  changes
    .reduce<Result.Result<SceneSnapshot, FeatureNotInScene>>(
      (acc, change) =>
        Result.flatMap(acc, (current) =>
          Result.map(getSlot(current, change.featureId), (slot) =>
            setSlot(current, change.featureId, { ...slot, state: change.state, rev: slot.rev + 1 }),
          ),
        ),
      Result.succeed(scene),
    )
    .pipe(Result.map((next) => ({ ...next, revision: scene.revision + 1 })))

/**
 * Forced change: bumps `forceEpoch`, so views drop any running transition and
 * render the state immediately. Without a new state it re-forces the current one.
 */
export const forceFeature = (
  scene: SceneSnapshot,
  featureId: string,
  state: Option.Option<unknown>,
): Result.Result<SceneSnapshot, FeatureNotInScene> =>
  Result.map(getSlot(scene, featureId), (slot) => ({
    ...setSlot(scene, featureId, {
      state: Option.getOrElse(state, () => slot.state),
      rev: slot.rev + 1,
      forceEpoch: slot.forceEpoch + 1,
    }),
    revision: scene.revision + 1,
  }))
