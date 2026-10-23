import "../dashboard.css"
import { Link } from "@tanstack/react-router"
import { MonitorPlay, SlidersHorizontal } from "lucide-react"
import { useApp } from "../AppContext.tsx"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card.tsx"

export default function SceneList() {
  const app = useApp()
  return (
    <main className="mx-auto grid min-h-svh max-w-3xl content-start gap-6 p-4 sm:p-8">
      <h1 className="text-2xl font-semibold">{app.config.title ?? "Overlay"}</h1>
      <div className="grid gap-4">
        {Object.entries(app.scenes).map(([sceneId, scene]) => (
          <Card key={sceneId}>
            <CardHeader>
              <div className="grid gap-1.5">
                <CardTitle>{scene.label}</CardTitle>
                <CardDescription>
                  {scene.features.map((featureId) => app.features[featureId]?.label ?? featureId).join(" · ")}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Link
                to="/scene/$sceneId"
                params={{ sceneId }}
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground [&_svg]:size-4"
              >
                <SlidersHorizontal /> Režie
              </Link>
              <a
                href={`/scene/${sceneId}/broadcast`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-sm font-medium hover:bg-accent [&_svg]:size-4"
              >
                <MonitorPlay /> Vysílací stránka
              </a>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  )
}
