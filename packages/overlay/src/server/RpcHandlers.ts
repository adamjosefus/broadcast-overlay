import { Effect, Option } from "effect"
import { OverlayRpcs } from "../protocol/rpcs.ts"
import { SceneStore } from "./SceneStore.ts"

export const RpcHandlers = OverlayRpcs.toLayer(
  Effect.gen(function* () {
    const store = yield* SceneStore
    return OverlayRpcs.of({
      ListScenes: () => Effect.succeed(store.scenes),
      SubscribeScene: ({ sceneId }) => store.subscribe(sceneId),
      ApplyNow: ({ sceneId, changes }) => store.applyNow(sceneId, changes),
      Force: ({ sceneId, featureId, state }) =>
        store.force(sceneId, featureId, Option.fromUndefinedOr(state)),
    })
  }),
)
