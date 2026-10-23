import { Effect, Option, Result } from "effect"
import type { Change } from "../core/model.ts"
import { OverlayClient, runtime } from "./runtime.ts"

/** Runs a command against the server; resolves with the typed failure, if any. */
const run = <E>(effect: Effect.Effect<void, E, OverlayClient>): Promise<Option.Option<E>> =>
  runtime
    .runPromise(Effect.result(effect))
    .then(Result.match({ onSuccess: () => Option.none<E>(), onFailure: (error) => Option.some(error) }))

export const commands = {
  applyNow: (sceneId: string, changes: ReadonlyArray<Change>) =>
    run(
      Effect.gen(function* () {
        const client = yield* OverlayClient
        yield* client.ApplyNow({ sceneId, changes })
      }),
    ),
  force: (sceneId: string, featureId: string, state: Option.Option<unknown>) =>
    run(
      Effect.gen(function* () {
        const client = yield* OverlayClient
        yield* client.Force(
          Option.match(state, {
            onNone: () => ({ sceneId, featureId }),
            onSome: (value) => ({ sceneId, featureId, state: value }),
          }),
        )
      }),
    ),
}
