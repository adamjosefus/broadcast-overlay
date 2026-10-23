import { getRouteApi } from "@tanstack/react-router"
import { Option } from "effect"
import { resolveScene, useApp } from "../AppContext.tsx"
import { SceneCanvas } from "../SceneCanvas.tsx"
import { useScene } from "../sceneSource.ts"

const route = getRouteApi("/scene/$sceneId/broadcast")

/** Page for the OBS Browser Source: 1920×1080, transparent, no UI. */
export const Broadcast = () => {
  const { sceneId } = route.useParams()
  const app = useApp()
  const view = useScene(sceneId)
  return Option.match(Option.all({ scene: resolveScene(app, sceneId), snapshot: view.snapshot }), {
    onNone: () => null,
    onSome: ({ scene, snapshot }) => <SceneCanvas scene={scene} slots={snapshot.features} />,
  })
}
