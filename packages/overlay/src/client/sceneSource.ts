import { Effect, Fiber, Option, Record, Schedule, Stream, SubscriptionRef } from "effect"
import { useSyncExternalStore } from "react"
import type { SceneNotFound } from "../core/errors.ts"
import type { SceneSnapshot } from "../core/model.ts"
import { OverlayClient, runtime } from "./runtime.ts"

export type ConnectionStatus = "connecting" | "live" | "reconnecting"

export interface SceneView {
  readonly status: ConnectionStatus
  readonly snapshot: Option.Option<SceneSnapshot>
  readonly notFound: Option.Option<SceneNotFound>
}

/**
 * Keeps the previous slot object when its revision did not change, so feature
 * state references stay stable and only changed features start a transition.
 */
export const shareSnapshot = (previous: Option.Option<SceneSnapshot>, next: SceneSnapshot): SceneSnapshot =>
  Option.match(
    Option.filter(previous, (prev) => prev.serverId === next.serverId),
    {
      onNone: () => next,
      onSome: (prev) => ({
        ...next,
        features: Record.map(next.features, (slot, featureId) =>
          Option.match(Record.get(prev.features, featureId), {
            onNone: () => slot,
            onSome: (prevSlot) =>
              prevSlot.rev === slot.rev && prevSlot.forceEpoch === slot.forceEpoch ? prevSlot : slot,
          }),
        ),
      }),
    },
  )

interface SceneSource {
  readonly subscribe: (listener: () => void) => () => void
  readonly getSnapshot: () => SceneView
}

const makeSceneSource = (sceneId: string): SceneSource => {
  const ref = runtime.runSync(
    SubscriptionRef.make<SceneView>({
      status: "connecting",
      snapshot: Option.none(),
      notFound: Option.none(),
    }),
  )

  const sync = Effect.gen(function* () {
    const client = yield* OverlayClient
    yield* client.SubscribeScene({ sceneId }).pipe(
      Stream.runForEach((snapshot) =>
        SubscriptionRef.update(ref, (view): SceneView => ({
          status: "live",
          snapshot: Option.some(shareSnapshot(view.snapshot, snapshot)),
          notFound: Option.none(),
        })),
      ),
    )
  }).pipe(
    Effect.catchTag("SceneNotFound", (error) =>
      SubscriptionRef.update(ref, (view): SceneView => ({
        ...view,
        status: "live",
        notFound: Option.some(error),
      })),
    ),
    Effect.tapError(() =>
      SubscriptionRef.update(ref, (view): SceneView => ({ ...view, status: "reconnecting" })),
    ),
    Effect.retry(Schedule.spaced("1 second")),
  )
  runtime.runFork(sync)

  return {
    subscribe: (listener) => {
      const fiber = runtime.runFork(
        SubscriptionRef.changes(ref).pipe(Stream.runForEach(() => Effect.sync(listener))),
      )
      return () => runtime.runFork(Fiber.interrupt(fiber))
    },
    getSnapshot: () => SubscriptionRef.getUnsafe(ref),
  }
}

const sources = new Map<string, SceneSource>()

const getSceneSource = (sceneId: string): SceneSource =>
  Option.getOrElse(Option.fromUndefinedOr(sources.get(sceneId)), () => {
    const source = makeSceneSource(sceneId)
    sources.set(sceneId, source)
    return source
  })

/** Live, server-synchronized state of a scene. */
export const useScene = (sceneId: string): SceneView => {
  const source = getSceneSource(sceneId)
  return useSyncExternalStore(source.subscribe, source.getSnapshot)
}
