import { Context, Effect, Layer, Option, Record, Schema, Stream, SubscriptionRef } from "effect"
import type { AppDefinition } from "../app.ts"
import type { AnyFeature } from "../definition.tsx"
import { FeatureNotInScene, type SceneCommandError, SceneNotFound } from "../core/errors.ts"
import type { Change, SceneInfo, SceneSnapshot } from "../core/model.ts"
import { applyChanges, forceFeature, makeScene, type ValidChange } from "../core/scene.ts"

export class InvalidAppDefinition extends Schema.TaggedError<InvalidAppDefinition>()("InvalidAppDefinition", {
  message: Schema.String,
}) {}

interface SceneEntry {
  readonly info: SceneInfo
  readonly features: Readonly<Record<string, AnyFeature>>
  readonly ref: SubscriptionRef.SubscriptionRef<SceneSnapshot>
}

/** Server-side source of truth for the state of all scenes. */
export class SceneStore extends Context.Service<
  SceneStore,
  {
    readonly scenes: ReadonlyArray<SceneInfo>
    /** Current snapshot followed by every later change. */
    readonly subscribe: (sceneId: string) => Stream.Stream<SceneSnapshot, SceneNotFound>
    readonly applyNow: (
      sceneId: string,
      changes: ReadonlyArray<Change>,
    ) => Effect.Effect<void, SceneCommandError>
    readonly force: (
      sceneId: string,
      featureId: string,
      state: Option.Option<unknown>,
    ) => Effect.Effect<void, SceneCommandError>
  }
>()("overlay/server/SceneStore") {
  static readonly layer = (definition: AppDefinition) =>
    Layer.effect(
      SceneStore,
      Effect.gen(function* () {
        const serverId = yield* Effect.sync(() => crypto.randomUUID())
        const entries = yield* Effect.forEach(
          Object.entries(definition.scenes),
          Effect.fnUntraced(function* ([sceneId, scene]) {
            const features = yield* Effect.forEach(scene.features, (featureId) =>
              Option.match(Record.get(definition.features, featureId), {
                onNone: () =>
                  Effect.fail(
                    new InvalidAppDefinition({
                      message: `Scene "${sceneId}" uses unknown feature "${featureId}"`,
                    }),
                  ),
                onSome: (feature) => Effect.succeed([featureId, feature] as const),
              }),
            )
            const initialStates = yield* Effect.forEach(features, ([featureId, feature]) =>
              Effect.fromResult(feature.erased.initialEncoded()).pipe(
                Effect.map((state) => [featureId, state] as const),
                Effect.mapError(
                  (error) =>
                    new InvalidAppDefinition({
                      message: `Initial state of feature "${featureId}" is invalid: ${error.message}`,
                    }),
                ),
              ),
            )
            const ref = yield* SubscriptionRef.make(
              makeScene(sceneId, serverId, Object.fromEntries(initialStates)),
            )
            const entry: SceneEntry = {
              info: {
                id: sceneId,
                label: scene.label,
                features: features.map(([featureId, feature]) =>
                  Option.match(feature.description, {
                    onNone: () => ({ id: featureId, label: feature.label }),
                    onSome: (description) => ({ id: featureId, label: feature.label, description }),
                  }),
                ),
              },
              features: Object.fromEntries(features),
              ref,
            }
            return [sceneId, entry] as const
          }),
        )
        const scenes: Readonly<Record<string, SceneEntry>> = Object.fromEntries(entries)

        const getScene = (sceneId: string) =>
          Effect.fromOption(Record.get(scenes, sceneId), () => new SceneNotFound({ sceneId }))

        const getFeature = (entry: SceneEntry, featureId: string) =>
          Effect.fromOption(
            Record.get(entry.features, featureId),
            () => new FeatureNotInScene({ sceneId: entry.info.id, featureId }),
          )

        const validate = (entry: SceneEntry, change: Change) =>
          getFeature(entry, change.featureId).pipe(
            Effect.flatMap((feature) => Effect.fromResult(feature.erased.normalize(change.state))),
            Effect.map((state): ValidChange => ({ featureId: change.featureId, state })),
          )

        const update = (entry: SceneEntry, f: (scene: SceneSnapshot) => ReturnType<typeof applyChanges>) =>
          SubscriptionRef.modifyEffect(entry.ref, (scene) =>
            Effect.fromResult(f(scene)).pipe(
              Effect.map((next): readonly [void, SceneSnapshot] => [undefined, next]),
            ),
          )

        return SceneStore.of({
          scenes: entries.map(([, entry]) => entry.info),
          subscribe: (sceneId) =>
            getScene(sceneId).pipe(
              Effect.map((entry) => SubscriptionRef.changes(entry.ref)),
              Stream.unwrap,
            ),
          applyNow: Effect.fn("SceneStore.applyNow")(function* (sceneId, changes) {
            const entry = yield* getScene(sceneId)
            const valid = yield* Effect.forEach(changes, (change) => validate(entry, change))
            yield* update(entry, (scene) => applyChanges(scene, valid))
          }),
          force: Effect.fn("SceneStore.force")(function* (sceneId, featureId, state) {
            const entry = yield* getScene(sceneId)
            const normalized = yield* Option.match(state, {
              onNone: () => Effect.succeed(Option.none<unknown>()),
              onSome: (value) =>
                validate(entry, { featureId, state: value }).pipe(
                  Effect.map((change) => Option.some(change.state)),
                ),
            })
            yield* getFeature(entry, featureId)
            yield* update(entry, (scene) => forceFeature(scene, featureId, normalized))
          }),
        })
      }),
    )
}
