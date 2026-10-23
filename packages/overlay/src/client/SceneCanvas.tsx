import { Option, Record } from "effect"
import type { FeatureSlot } from "../core/model.ts"
import type { ResolvedScene } from "./AppContext.tsx"

export const CANVAS_WIDTH = 1920
export const CANVAS_HEIGHT = 1080

/** Encoded state that replaces the live one (e.g. a draft in the editor preview). */
export interface StateOverride {
  readonly featureId: string
  readonly encoded: unknown
}

/**
 * Renders all features of a scene on a fixed 1920×1080 canvas. Each feature gets
 * its own full-size layer, so it can position itself freely.
 */
export const SceneCanvas = ({
  scene,
  slots,
  override,
}: {
  readonly scene: ResolvedScene
  readonly slots: Readonly<Record<string, FeatureSlot>>
  readonly override?: StateOverride | undefined
}) => (
  <div
    style={{
      position: "relative",
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      overflow: "hidden",
    }}
  >
    {scene.features.map(([featureId, feature]) =>
      Option.match(Record.get(slots, featureId), {
        onNone: () => null,
        onSome: (slot) => {
          const Renderer = feature.erased.Renderer
          const encoded = override?.featureId === featureId ? override.encoded : slot.state
          return (
            <div key={featureId} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
              <Renderer encoded={encoded} forceEpoch={slot.forceEpoch} />
            </div>
          )
        },
      }),
    )}
  </div>
)
