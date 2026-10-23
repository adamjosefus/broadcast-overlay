import { Feature, type FeatureViewProps, Schema } from "overlay"
import { NameTag, type NameTagProps } from "../components/NameTag.tsx"

const accents = { red: "#e5383b", blue: "#2f6fed", green: "#1f9d55" } as const

const LowerThirdState = Schema.Struct({
  visible: Schema.Boolean.annotate({ title: "Zobrazit" }),
  name: Schema.String.annotate({ title: "Jméno" }),
  role: Schema.String.annotate({ title: "Funkce", description: "Druhý řádek lišty" }),
  accent: Schema.Literals(["red", "blue", "green"]).annotate({ title: "Barva" }),
})

interface LowerThirdView {
  readonly visible: boolean
  readonly accent: string
  readonly name: NameTagProps
  readonly role: NameTagProps
}

const LowerThird = ({ state, force }: FeatureViewProps<LowerThirdView>) => (
  <div
    style={{
      position: "absolute",
      left: 120,
      bottom: 110,
      display: "flex",
      fontFamily: "Inter, system-ui, sans-serif",
      color: "white",
      transform: state.visible ? "none" : "translateX(-140%)",
      // A forced change skips the slide; the epoch is part of the transition key.
      transition: `transform 600ms cubic-bezier(.2,.8,.2,1)`,
    }}
    key={force.epoch}
  >
    <div style={{ width: 14, background: state.accent, transition: "background 400ms" }} />
    <div
      style={{ background: "rgba(10,10,14,.88)", padding: "18px 36px 20px 28px", display: "grid", gap: 4 }}
    >
      <NameTag.View state={state.name} force={force} />
      <div style={{ opacity: 0.8 }}>
        <NameTag.View state={state.role} force={force} />
      </div>
    </div>
  </div>
)

export const lowerThird = Feature.make({
  label: "Spodní lišta",
  description: "Jméno a funkce hosta",
  state: LowerThirdState,
  initial: { visible: false, name: "Jana Nováková", role: "Moderátorka", accent: "red" },
  // Memoized by reference, so the name/role objects only change with the state.
  select: (s) => ({
    visible: s.visible,
    accent: accents[s.accent],
    name: { text: s.name, size: 46, weight: 700 },
    role: { text: s.role, size: 28, weight: 400 },
  }),
  components: [NameTag],
  view: LowerThird,
})
