import { Schema } from "effect"
import { App, type FeatureIdOf, type SceneIdOf } from "./app.ts"
import { Feature } from "./definition.tsx"

// Compile-time checks only: `deno check` / `deno test` fail when inference regresses.

const State = Schema.Struct({ text: Schema.String, size: Schema.Number })

const plain = Feature.make({
  label: "Plain",
  state: State,
  initial: { text: "a", size: 1 },
  view: ({ state }) => {
    const text: string = state.text
    return text.length > 0 ? null : null
  },
})

const selected = Feature.make({
  label: "Selected",
  state: State,
  initial: { text: "a", size: 1 },
  select: (state) => ({ label: state.text.toUpperCase() }),
  view: ({ state }) => {
    const label: string = state.label
    return label.length > 0 ? null : null
  },
})

Feature.make({
  label: "Wrong initial",
  state: State,
  // @ts-expect-error — `size` must be a number
  initial: { text: "a", size: "1" },
  view: () => null,
})

Feature.make({
  label: "Wrong view",
  state: State,
  initial: { text: "a", size: 1 },
  // @ts-expect-error — the selected shape does not match what the view accepts
  select: (state) => ({ label: state.text }),
  view: ({ state }: { state: { other: number } }) => (state.other > 0 ? null : null),
})

const app = new App()
  .defineFeatures({ plain, selected })
  .defineScenes({ main: { label: "Main", features: ["plain", "selected"] } })

new App().defineFeatures({ plain }).defineScenes({
  // @ts-expect-error — unknown feature id
  main: { label: "Main", features: ["plian"] },
})

const featureId: FeatureIdOf<typeof app> = "selected"
const sceneId: SceneIdOf<typeof app> = "main"
// @ts-expect-error — not a scene of the app
const wrongScene: SceneIdOf<typeof app> = "pause"

Deno.test("public API types compile", () => {
  void [featureId, sceneId, wrongScene]
})
