import "../dashboard.css"
import { getRouteApi, Link } from "@tanstack/react-router"
import { Option, Record, Result } from "effect"
import { Check, ChevronLeft, Copy, Send, Undo2, Wifi, WifiOff, Zap } from "lucide-react"
import { useState } from "react"
import type { FeatureSlot } from "../../core/model.ts"
import type { AnyFeature } from "../../definition.tsx"
import { type ResolvedScene, resolveScene, useApp } from "../AppContext.tsx"
import { commands } from "../commands.ts"
import { SchemaForm } from "../form/SchemaForm.tsx"
import { cn } from "../lib/cn.ts"
import { ScaledFrame } from "../ScaledFrame.tsx"
import { CANVAS_HEIGHT, CANVAS_WIDTH, SceneCanvas } from "../SceneCanvas.tsx"
import { type ConnectionStatus, useScene } from "../sceneSource.ts"
import { Badge } from "../ui/badge.tsx"
import { Button } from "../ui/button.tsx"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card.tsx"
import { Input } from "../ui/input.tsx"

const route = getRouteApi("/scene/$sceneId")

interface Failure {
  readonly _tag: string
  readonly message: string
}

const describeFailure = (failure: Failure) =>
  failure.message.length > 0 ? `${failure._tag}: ${failure.message}` : failure._tag

export default function Dashboard() {
  const { sceneId } = route.useParams()
  const app = useApp()
  const view = useScene(sceneId)

  return Option.match(resolveScene(app, sceneId), {
    onNone: () => <Centered>Scéna „{sceneId}“ neexistuje.</Centered>,
    onSome: (scene) =>
      Option.match(view.snapshot, {
        onNone: () => <Centered>Připojuji se k serveru…</Centered>,
        onSome: (snapshot) => <SceneDashboard scene={scene} slots={snapshot.features} status={view.status} />,
      }),
  })
}

const Centered = ({ children }: { readonly children: React.ReactNode }) => (
  <main className="grid min-h-svh place-items-center p-4 text-muted-foreground">{children}</main>
)

const StatusBadge = ({ status }: { readonly status: ConnectionStatus }) =>
  status === "live" ? (
    <Badge variant="live">
      <Wifi /> Připojeno
    </Badge>
  ) : (
    <Badge variant="destructive">
      <WifiOff /> {status === "connecting" ? "Připojuji…" : "Obnovuji spojení…"}
    </Badge>
  )

const CopyUrl = ({ url }: { readonly url: string }) => {
  const [copied, setCopied] = useState(false)
  const copy = () =>
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      })
      .catch(() => setCopied(false))
  return (
    <div className="flex w-full max-w-md items-center gap-2">
      <Input readOnly value={url} onFocus={(e) => e.target.select()} aria-label="URL vysílací stránky" />
      <Button variant="outline" size="icon" onClick={copy} title="Kopírovat URL pro OBS">
        {copied ? <Check /> : <Copy />}
      </Button>
    </div>
  )
}

const SceneDashboard = ({
  scene,
  slots,
  status,
}: {
  readonly scene: ResolvedScene
  readonly slots: Readonly<Record<string, FeatureSlot>>
  readonly status: ConnectionStatus
}) => {
  const [selectedId, setSelectedId] = useState(() => scene.features[0]?.[0] ?? "")
  const [drafts, setDrafts] = useState<Readonly<Record<string, unknown>>>({})
  const [failure, setFailure] = useState<Option.Option<string>>(Option.none())
  const broadcastUrl = `${globalThis.location.origin}/scene/${scene.id}/broadcast`

  const selected = Option.all({
    feature: Option.fromUndefinedOr(scene.features.find(([featureId]) => featureId === selectedId)?.[1]),
    slot: Record.get(slots, selectedId),
  })

  const draftOf = (featureId: string, slot: FeatureSlot) =>
    Option.getOrElse(Record.get(drafts, featureId), () => slot.state)

  const discard = (featureId: string) => setDrafts((current) => Record.remove(current, featureId))

  const report = (featureId: string) => (result: Option.Option<Failure>) =>
    Option.match(result, {
      onNone: () => {
        setFailure(Option.none())
        discard(featureId)
      },
      onSome: (error) => setFailure(Option.some(describeFailure(error))),
    })

  return (
    <main className="mx-auto grid max-w-[1800px] gap-4 p-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-muted-foreground hover:text-foreground" aria-label="Seznam scén">
            <ChevronLeft className="size-5" />
          </Link>
          <h1 className="text-xl font-semibold">{scene.definition.label}</h1>
          <StatusBadge status={status} />
        </div>
        <CopyUrl url={broadcastUrl} />
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="grid gap-1.5">
              <CardTitle>Příprava</CardTitle>
              <CardDescription>Rozpracovaný stav – zatím ho nevidí nikdo jiný.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex flex-wrap gap-2">
              {scene.features.map(([featureId, feature]) => (
                <Button
                  key={featureId}
                  size="sm"
                  variant={featureId === selectedId ? "default" : "outline"}
                  onClick={() => setSelectedId(featureId)}
                >
                  {feature.label}
                  {Record.has(drafts, featureId) ? (
                    <span className="size-1.5 rounded-full bg-amber-500" />
                  ) : null}
                </Button>
              ))}
            </div>
            <ScaledFrame>
              <SceneCanvas
                scene={scene}
                slots={slots}
                override={Option.match(selected, {
                  onNone: () => undefined,
                  onSome: ({ slot }) => ({ featureId: selectedId, encoded: draftOf(selectedId, slot) }),
                })}
              />
            </ScaledFrame>
            {Option.match(selected, {
              onNone: () => null,
              onSome: ({ feature, slot }) => (
                <FeatureEditor
                  key={selectedId}
                  feature={feature}
                  draft={draftOf(selectedId, slot)}
                  dirty={Record.has(drafts, selectedId)}
                  onChange={(value) => setDrafts((current) => ({ ...current, [selectedId]: value }))}
                  onApply={(value) =>
                    commands
                      .applyNow(scene.id, [{ featureId: selectedId, state: value }])
                      .then(report(selectedId))
                  }
                  onForce={(value) =>
                    commands.force(scene.id, selectedId, Option.some(value)).then(report(selectedId))
                  }
                  onDiscard={() => discard(selectedId)}
                />
              ),
            })}
            {Option.match(failure, {
              onNone: () => null,
              onSome: (message) => <p className="text-sm text-destructive">{message}</p>,
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="grid gap-1.5">
              <CardTitle>Živě</CardTitle>
              <CardDescription>Přesně to, co právě vidí OBS, včetně přechodů.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4">
            <ScaledFrame>
              {/* oxlint-disable-next-line react/iframe-missing-sandbox -- our own broadcast page, it needs scripts and its origin */}
              <iframe
                title="Živý náhled"
                src={broadcastUrl}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                style={{ border: 0, background: "transparent" }}
              />
            </ScaledFrame>
            <div className="grid gap-2">
              <p className="text-sm font-medium">Záchranná brzda</p>
              <div className="flex flex-wrap gap-2">
                {scene.features.map(([featureId, feature]) => (
                  <Button
                    key={featureId}
                    size="sm"
                    variant="outline"
                    aria-label={`Vynutit aktuální stav: ${feature.label}`}
                    onClick={() => commands.force(scene.id, featureId, Option.none()).then(report(featureId))}
                  >
                    <Zap /> {feature.label}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

const FeatureEditor = ({
  feature,
  draft,
  dirty,
  onChange,
  onApply,
  onForce,
  onDiscard,
}: {
  readonly feature: AnyFeature
  readonly draft: unknown
  readonly dirty: boolean
  readonly onChange: (value: unknown) => void
  readonly onApply: (value: unknown) => void
  readonly onForce: (value: unknown) => void
  readonly onDiscard: () => void
}) => {
  const validated = feature.erased.normalize(draft)
  return (
    <div className="grid gap-4">
      {Option.match(feature.description, {
        onNone: () => null,
        onSome: (description) => <p className="text-sm text-muted-foreground">{description}</p>,
      })}
      <SchemaForm ast={feature.schema.ast} value={draft} onChange={onChange} />
      {Result.match(validated, {
        onSuccess: () => null,
        onFailure: (error) => <p className="whitespace-pre-wrap text-sm text-destructive">{error.message}</p>,
      })}
      <div className={cn("flex flex-wrap gap-2")}>
        {Result.match(validated, {
          onFailure: () => null,
          onSuccess: (value) => (
            <>
              <Button onClick={() => onApply(value)}>
                <Send /> Použít
              </Button>
              <Button variant="secondary" onClick={() => onForce(value)}>
                <Zap /> Vynutit
              </Button>
            </>
          ),
        })}
        <Button variant="ghost" disabled={!dirty} onClick={onDiscard}>
          <Undo2 /> Zahodit změny
        </Button>
      </div>
    </div>
  )
}
