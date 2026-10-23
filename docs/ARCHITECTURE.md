# OBS Overlay Engine – architektura

## Kontext

Knihovna po importu spustí lokální webovou aplikaci (server + režie + vysílací stránky pro OBS Browser Source). Uživatel do ní přes typované API registruje vlastní features/komponenty a scény.

## Stav implementace (milník 1 hotový)

Co se při implementaci oproti původnímu návrhu změnilo nebo upřesnilo:

- **Effect 4** (`effect@4.0.6`) – HTTP, RPC a sockety jsou přímo v balíčku `effect` (`effect/http`, `effect/rpc`, `effect/socket`).
- **Vite není middleware, ale samostatný dev server** na veřejném portu; `/rpc` (WebSocket) proxuje na interní Effect HTTP server na náhodném portu `127.0.0.1`. Odpadá napojování connect middleware do Effect serveru.
- **Vstupní modul** pro prohlížeč je `Deno.mainModule` (lze přepsat `app.start({ entry })`). Načítá se přes `/overlay-entry` a `App.start()` se v prohlížeči nahradí registrací definice (`client/start.ts`). Vstupní modul proto nesmí na top-level importovat serverový kód. Assety se zatím vkládají inline nebo přes `new URL("./x.svg", import.meta.url)`.
- **`defineFeatures` přijímá výsledky `Feature.make`**, ne inline objekty – inference `select` → `view` je u `Feature.make` spolehlivá (kryto typovými testy v `src/types.test.ts`).
- **Stabilní reference:** kromě revizí slotů na klientu stabilizuje knihovna referenci stavu na hranici každé feature i komponenty strukturálním porovnáním (`Equal.equals`). Bez toho by `select`, který staví nové objekty, spouštěl přechody i u nezměněných komponent.
- Snapshot nese `serverId`, aby klient po restartu serveru nepoužil zastaralé reference se stejnou revizí.
- Fronta, mobilní pohled, editor jedné feature, klávesové zkratky a persistence jsou **milník 2/3**; RPC zatím obsahuje `ListScenes`, `SubscribeScene`, `ApplyNow` a `Force`.

---

## 1. Zásadní riziko hned na začátku: TanStack Start

**TanStack Start nedoporučuji.** Důvody:

- Start je framework, který _vlastní_ server i build (Vite + Nitro, file-based routy). My potřebujeme opak: knihovnu, která je závislostí cizího projektu a do jejíchž pohledů uživatel _za běhu_ vkládá svoje React komponenty.
- File-based routy by ležely v `node_modules`/JSR cache a build by musel běžet v projektu uživatele s routami knihovny – křehké a nepodporované.
- Server chceme v Effectu (WS, služby, typované chyby); Startův serverový runtime by byl druhý, konkurenční server.
- SSR nepotřebujeme (OBS i režie jsou čistě klientské, realtime).

**Návrh:** SPA na **TanStack Router (code-based routes)** + **TanStack Form** (podporuje Standard Schema → Effect Schema přes `Schema.standardSchemaV1`) + vlastní realtime store. Server = **Effect Platform** (`HttpServer` + WebSocket) běžící na Denu.

Druhé riziko – **bundlování uživatelských komponent**: views (a jejich assety: obrázky, CSS, fonty) musí skončit v prohlížeči, takže se v projektu uživatele musí spustit bundler. Řešení: knihovna při `start()` programově spustí **Vite** (dev: middleware mode s HMR; prod: build do cache složky), s vlastním pluginem, který poskytne virtuální modul `virtual:overlay-app` = uživatelův config. Server načte stejný config přes Vite `ssrLoadModule`, takže i importy assetů (`import logo from "./logo.svg"`) fungují uniformně. Ve výsledku běží Vite na veřejném portu a WebSocket proxuje na interní Effect HTTP server (`@effect/platform-node` v Node-kompatibilitě Deno).

---

## 2. Architektura

### Struktura repa (pnpm monorepo, runtime Deno)

Rozhodnuto: **pnpm workspace** se dvěma projekty – knihovna a ukázkový „pseudokonkrétní“ projekt. Publikace se teď neřeší (výhledově npm). Závislosti spravuje pnpm (`package.json` v každém balíčku, `pnpm-workspace.yaml`, odkaz `"overlay": "workspace:*"`); Deno běží s `"nodeModulesDir": "manual"` nad `node_modules` od pnpm. Skripty v `package.json` volají `deno run …`, `oxlint`, `oxfmt`, aby `pnpm -r <script>` fungovalo z rootu.

```
pnpm-workspace.yaml
package.json              # root skripty: dev, check, lint, fmt, test
deno.json                 # compilerOptions (strict), nodeModulesDir: manual
packages/overlay/         # knihovna
  src/
    index.ts              # izomorfní veřejné API: App, Feature, Component, Schema re-export
    react.ts              # helpery pro autory: useStateTransition, typy props
    core/                 # čistá doména, žádné side-effecty
      model.ts            # Scene, FeatureSlot, Queue, QueueGroup (Effect Schema)
      queue.ts            # čisté redukce: enqueue/attach/move/remove/advance
      scene.ts            # applyChanges, force
    protocol/             # RPC definice odvozené z App definice (schema factory)
    server/               # Deno-only, vše Effect
      main.ts             # start(app, config): Effect program → runMain
      SceneStore.ts       # Context.Tag + Layer; SynchronizedRef<ServerState> + PubSub
      RpcHandlers.ts      # WS RPC handlery
      Http.ts             # router: statika / Vite middleware, /rpc websocket
      Bundler.ts          # Vite (dev/prod), virtuální modul s uživatelským configem
    client/               # prohlížeč
      runtime.ts          # ManagedRuntime: RPC klient přes WS, reconnect (Schedule)
      store.ts            # snapshot store + structural sharing → useSyncExternalStore
      routes/             # broadcast, dashboard, feature editor, queue (mobil)
      ui/                 # vendorované shadcn/ui komponenty, Tailwind (předkompilované CSS)
      form/               # generátor formuláře z Effect Schema AST + anotací
apps/demo-show/           # pseudokonkrétní projekt (např. talk show: logo, spodní lišta s hostem, odpočet, ticker)
  overlay.config.tsx, main.ts, src/features/*, src/assets/*
```

### Hranice server / klient

- `index.ts` je **izomorfní** – definice feature obsahuje schéma (server i klient) i `view` (jen klient; na serveru se React komponenta importuje, ale nikdy nerenderuje).
- `app.start()` dynamicky importuje `server/main.ts`; Vite plugin knihovny v klientském buildu tento modul nahradí stubem, takže se do prohlížeče nedostane Deno kód.

### Routy (TanStack Router, parametry validované Effect Schema)

| URL                                  | Pohled                                                                                                                                    |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `/scene/$sceneId/broadcast`          | vysílací stránka: 1920×1080, `background: transparent`, žádné UI, **nenačítá CSS režie** (Tailwind preflight by rozbil vizuály uživatele) |
| `/scene/$sceneId`                    | dashboard: fronta, editor/náhled vlevo, živý náhled vpravo, kopírovat URL                                                                 |
| `/scene/$sceneId/feature/$featureId` | editace jedné feature (tablet)                                                                                                            |
| `/scene/$sceneId/queue`              | odbavení + monitoring fronty (mobil)                                                                                                      |
| `/`                                  | seznam scén                                                                                                                               |

**Živý náhled = `<iframe>` vysílací URL** zmenšený přes CSS `transform: scale()`. Je to přesně to, co vidí OBS (stejný kód, stejné přechody, izolované CSS). Levý editor renderuje rozpracovaný (lokální) stav in-process ve zmenšeném 1920×1080 plátně.

### Tok stavu

```
klient (draft, lokální) ──RPC: Enqueue/Attach/Advance/Force──▶ server
server: SynchronizedRef — příkazy se aplikují sériově čistými redukcemi z core/,
        každá změna zvýší revizi; publikuje do PubSub
server ──stream SceneSnapshot──▶ všichni odběratelé scény (dashboardy, OBS, mobily)
klient: structural sharing podle revize slotu → nezměněné features drží STEJNOU referenci
```

**Klíčový detail:** kontrakt „přechod při jiné referenci“ vyžaduje, aby klient zachoval referenci stavu feature, který se nezměnil. Každý `FeatureSlot` má vlastní `rev`; store při novém snapshotu znovupoužije předchozí objekt, pokud `rev` sedí. Jinak by každý snapshot spustil přechod všech features.

### Serverový stav

```ts
ServerState = { scenes: Record<SceneId, SceneRuntime> }
SceneRuntime = {
  revision: number
  features: Record<FeatureId, FeatureSlot>   // FeatureSlot = { state, rev, forceEpoch }
  queue: ReadonlyArray<QueueGroup>
}
QueueGroup = { id: QueueItemId, changes: NonEmptyReadonlyArray<Change> }  // „s předchozí“ = další change ve stejné skupině
Change = { featureId, state }   // celý nový stav feature, validovaný jejím schématem
```

- „Nová položka“ = nová `QueueGroup` (po předchozí); „připojit k předchozí“ = přidat `Change` do poslední skupiny (s předchozí). Dvě změny téže feature ve skupině → poslední vyhrává (validace v redukci, typovaná chyba).
- `Advance { expectedHeadId }` – ochrana proti dvojímu odbavení, když dva operátoři zmáčknou současně (druhý dostane `QueueHeadMismatch`).
- Operace nad frontou adresují položky ID, ne indexy.
- Persistence (M3): snapshot `ServerState` do JSON souboru (cesta přes `@std/path`), při startu dekódovat Schemou; nevalidní/staré stavy feature → fallback na `initial` + varování.

### WebSocket protokol – `@effect/rpc` přes WebSocket

Místo ručního protokolu doporučuji `@effect/rpc` (Schema na obou stranách, typované chyby přes drát, streaming pro odběry). RPC skupina se **vyrábí z definice App** (`makeRpcs(app)`), takže payload `Change` je `Schema.Union` per feature: `{ featureId: Literal("logo"), state: logo.state } | …` – validace i typy jsou přesné end-to-end.

| RPC                                                    | Směr / typ                                  | Chyby                                                           |
| ------------------------------------------------------ | ------------------------------------------- | --------------------------------------------------------------- |
| `SubscribeScene { sceneId }`                           | stream `SceneSnapshot`                      | `SceneNotFound`                                                 |
| `ListScenes`                                           | request                                     | –                                                               |
| `Enqueue { sceneId, change, mode: "after" \| "with" }` | request → `QueueItemId`                     | `SceneNotFound`, `FeatureNotInScene`, `QueueEmpty` (pro `with`) |
| `UpdateQueueItem / RemoveQueueItem / MoveQueueItem`    | request                                     | `QueueItemNotFound`                                             |
| `Advance { sceneId, expectedHeadId }`                  | request                                     | `QueueEmpty`, `QueueHeadMismatch`                               |
| `ApplyNow { sceneId, changes }`                        | request (obejde frontu)                     | jako Enqueue                                                    |
| `Force { sceneId, featureId, state? }`                 | request – nastaví stav a zvýší `forceEpoch` | `FeatureNotInScene`                                             |

Fallback, pokud by `@effect/rpc` na Denu/WS narazil: ruční protokol `Schema.TaggedClass` zpráv s `requestId`, sémanticky identický.

---

## 3. Kontrakt Feature / Component v Reactu

**Volba: deklarativní props + „force signál“ (epocha), ne imperativní handle.**

```ts
type ForceSignal = { readonly epoch: number }

type StatefulProps<S> = {
  readonly state: S // změna reference ⇒ přechod
  readonly force: ForceSignal // změna epochy ⇒ okamžité nastavení `state`, zahození snapshotu/přechodu
}
type FeatureViewProps<S> = StatefulProps<S>
type ComponentViewProps<P> = StatefulProps<P>
```

Proč signál a ne `ref.setStateForce()`:

- Force přichází **ze serveru** (operátor na tabletu ⇒ WS ⇒ OBS stránka). Je to data, ne volání – epocha v `FeatureSlot` je serializovatelná, persistovatelná a dorazí do všech klientů včetně živého náhledu.
- Feature jen předá stejný `force` svým komponentám – žádné drátování refů na každé dítě, žádná imperativní choreografie.
- Funguje i při remountu (epocha je součást stavu, ref by se ztratil).
- `setStateForce` tak v API existuje jako **operace** (`Force` RPC, tlačítko v režii u každé feature), komponenty na ni reagují deklarativně.

Helper pro autory (volitelný, autor může psát přechody po svém):

```ts
const t = useStateTransition(props, {
  // kdy je přechod hotov: časem, nebo voláním t.done() (např. onAnimationEnd)
  duration: 400,
  onInterrupt: "restart" | "queue-latest",
})
// t.current: S, t.previous: Option<S>, t.phase: "idle" | "running", t.done(): void
```

Hook drží snapshot předchozího stavu, dokud přechod běží; při změně `force.epoch` ho okamžitě zahodí.

**Selector:** feature dostane jen svůj slice; transformace je `select` v definici. Knihovna výsledek memoizuje podle reference vstupu (jinak by selektor vracel nové objekty a spouštěl falešné přechody).

---

## 4. Veřejné API

Vychází z tvého náčrtu, ale `App` je **imutabilní builder** – mutující `app.defineFeatures()` by nedokázal změnit typ proměnné `app`, takže identifikátory features by se nepropsaly do scén. Každá metoda vrací novou instanci s rozšířeným typem.

```ts
// overlay.config.tsx (projekt uživatele)
import { App, Component, Feature, Schema } from "obs-overlay"

// Komponenta: nevlastní doménový stav, jen typ props
const NameTag = Component.make({
  name: "NameTag",
  props: Schema.Struct({ text: Schema.String }),
  view: NameTagView, // React.FC<ComponentViewProps<{ readonly text: string }>> – typ odvozen
})

const lowerThird = Feature.make({
  label: "Spodní lišta",
  description: "Jméno a funkce hosta",
  state: Schema.Struct({
    visible: Schema.Boolean.annotations({ title: "Zobrazit" }),
    name: Schema.String.annotations({ title: "Jméno" }),
    role: Schema.String.annotations({ title: "Funkce" }),
  }),
  initial: { visible: false, name: "", role: "" }, // typově kontrolováno proti schématu
  select: (s) => ({ visible: s.visible, title: { text: s.name }, subtitle: { text: s.role } }),
  components: [NameTag],
  view: LowerThirdView, // props.state má typ výstupu `select`
})

export default new App({ server: { port: 4000, host: "0.0.0.0" } })
  .defineFeatures({ lowerThird, logo })
  .defineScenes({
    main: { label: "Hlavní", features: ["logo", "lowerThird"] }, // ✅ autocomplete, ❌ "lgo" je chyba typu
    pause: { label: "Pauza", features: ["logo"] },
  })
```

```ts
// main.tsx (spouští se `deno run -A main.tsx`; tentýž modul se načte i v prohlížeči)
await app.start()
```

Typové jádro (náčrt):

```ts
Feature.make: <S extends Schema.Schema.AnyNoContext, V = Schema.Schema.Type<S>>(def: {
  label: string; description?: string
  state: S
  initial: Schema.Schema.Type<S>
  select?: (s: Schema.Schema.Type<S>) => V
  components?: ReadonlyArray<AnyComponent>
  view: React.ComponentType<FeatureViewProps<V>>
}) => Feature<S, V>

class App<F extends Record<string, AnyFeature> = {}, Sc extends Record<string, SceneDef<keyof F & string>> = {}> {
  defineFeatures<const NF extends Record<string, AnyFeature>>(f: NF): App<F & NF, Sc>
  defineScenes<const NS extends Record<string, SceneDef<keyof F & string>>>(s: NS): App<F, Sc & NS>
  start(config?: StartConfig): Promise<void> // tenká fasáda nad Effect programem
}
```

- Interně: `App` jen drží imutabilní `AppDefinition`; `start` = `Effect.runPromise(Server.program(def).pipe(Effect.provide(layers)))`. Pro uživatele Effectu bude exportováno i `Server.layer(def)`, aby šlo server složit do vlastního Effect programu.
- Uvnitř registru se features ukládají type-erased (`AnyFeature`) – hranice jsou kryté Schemou, takže **nepotřebujeme `as`**.
- **Formulář v režii** se generuje z AST schématu (`String`, `Number`, `Boolean`, `Literal` union → select, `Struct`, `Array`) + anotací `title`, `description`, a vlastní anotace `overlay.widget` (např. `"color"`, `"textarea"`). Neznámé typy → JSON editor s validací. Feature si může dodat i vlastní `editor` komponentu.

---

## 5. Zásady a nástroje

- pnpm skripty: `dev` (demo-show), `check` (`deno check`), `lint` (`oxlint`), `fmt` (`oxfmt`), `test` (`deno test`, jeden test: `deno test path/to/file.test.ts --filter "název"`).
- oxlint: `typescript/no-explicit-any`, `typescript/no-non-null-assertion`, `typescript/consistent-type-assertions` (assertionStyle `never`) – zákaz `as`/`any`/`!` vynucený lintem, ne jen konvencí.
- TS strict + `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`.
- Multiplatformnost: cesty jen přes `@std/path`/`import.meta.resolve`, žádné shell příkazy, žádné nativní npm moduly.
- Tailwind + shadcn: CSS režie předkompilované při publikaci balíčku; uživatelské vizuály ho nedostanou.

---

## 6. Otevřené otázky a rizika

Rozhodnuto: Router SPA místo TanStack Start; pnpm monorepo, publikace později (npm); features ve scéně **trvale namountované** (viditelnost řídí stav feature).

1. **pnpm + Deno:** ověřit ve spiku, že Deno korektně resolvuje `workspace:*` balíčky a npm závislosti z pnpm `node_modules` (symlinky) na všech třech OS. Fallback: `node-linker=hoisted` v `.npmrc`.
2. **Výhledová publikace na npm** – kód knihovny psát tak, aby Deno-specifické API (`Deno.*`) byly jen v `server/` za Effect službou (snadná výměna za Node adaptér).
3. **Více instancí jedné feature ve scéně** (dvě lišty současně)? Mění to klíčování slotů (`featureId` → `instanceId`).
4. **Scény: statické z kódu, nebo vytvářené za běhu?** Návrh: definice scén v kódu (stabilní URL pro OBS); runtime vytváření později, pokud bude potřeba.
5. **Drafty v editoru** – lokální per klient (návrh), nebo sdílené (dva lidé na jedné liště)?
6. **Zabezpečení v LAN** – bez auth, nebo jednoduchý sdílený PIN/token v URL? Návrh: volitelný token v configu.
7. **Verze Effectu** – Effect 3 vs. Effect 4 (přesouvá platform/rpc do jádra). Ověřím stav při scaffoldu a zafixuji verzi.
8. **Rizika:** Vite + Node HTTP compat na Denu (ověřit první); zralost `oxfmt`; reverse-mapped inference u inline features; časování přechodů v OBS (CEF throttling – použít `requestAnimationFrame`/CSS, ne `setTimeout`).

---

## 7. Milník 1 (hotovo)

Cíl: jedna scéna, jedna ukázková feature, vysílací stránka, synchronizace přes WS mezi dvěma klienty.

1. **Scaffold:** pnpm workspace (`packages/overlay`, `apps/demo-show`), root `deno.json` (strict TS), skripty v `package.json`, oxlint/oxfmt config. Spike: Effect HTTP server + Vite middleware na Denu servíruje Hello World React – ověří riziko z §1.
2. **core + protocol:** Schema modelu, čisté redukce (`applyChanges`, `force`), `makeRpcs(app)`; unit testy redukcí.
3. **server:** `SceneStore` (Layer, SynchronizedRef + PubSub), RPC handlery `SubscribeScene`, `ApplyNow`, `Force`; `App.start()` fasáda.
4. **client runtime:** RPC klient přes WS s reconnectem, store se structural sharingem, `useScene(sceneId)`.
5. **Pohledy:** `/scene/$id/broadcast` (1920×1080, průhledné) a minimální `/scene/$id` (generovaný formulář + „Použít“ + „Force“).
6. **Ukázková feature** `lowerThird` v `apps/demo-show` s CSS přechodem přes `useStateTransition`.
7. Aktualizace `CLAUDE.md` (příkazy, architektura).

Fronta, mobilní pohled, klávesové zkratky, persistence → Milník 2/3.

## Ověření M1 (provedeno)

- `pnpm check && pnpm lint && pnpm test` – zelené.
- `pnpm --filter demo-show dev`; otevřít vysílací URL ve dvou záložkách (a v OBS Browser Source, pokud je k dispozici) + dashboard v jiném prohlížeči/telefonu v LAN.
- Změna stavu z dashboardu ⇒ obě vysílací stránky přejdou animovaně a shodně; nezměněné features nepřecházejí.
- „Force“ během přechodu ⇒ okamžitý skok na cílový stav.
- Restart/odpojení klienta ⇒ reconnect a obnova snapshotu ze serveru.
- Nevalidní zpráva (ručně přes WS) ⇒ typovaná chyba, server nespadne.
- Ověřit v browser pane (Claude_Browser) screenshotem průhlednost a rozměr vysílací stránky.
