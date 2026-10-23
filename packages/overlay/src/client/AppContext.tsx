import { Option, Record } from "effect"
import { createContext, useContext } from "react"
import type { AppDefinition, SceneDefinition } from "../app.ts"
import type { AnyFeature } from "../definition.tsx"

const AppContext = createContext<Option.Option<AppDefinition>>(Option.none())

export const AppProvider = AppContext.Provider

export const useApp = (): AppDefinition =>
  Option.getOrThrowWith(useContext(AppContext), () => new Error("AppProvider is missing"))

export interface ResolvedScene {
  readonly id: string
  readonly definition: SceneDefinition<string>
  readonly features: ReadonlyArray<readonly [string, AnyFeature]>
}

export const resolveScene = (app: AppDefinition, sceneId: string): Option.Option<ResolvedScene> =>
  Option.map(Record.get(app.scenes, sceneId), (definition) => ({
    id: sceneId,
    definition,
    features: definition.features.flatMap((featureId) =>
      Option.match(Record.get(app.features, featureId), {
        onNone: () => [],
        onSome: (feature) => [[featureId, feature] as const],
      }),
    ),
  }))
