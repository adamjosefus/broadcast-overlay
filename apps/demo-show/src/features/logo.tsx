import { Feature, type FeatureViewProps, Schema } from "overlay"

const LogoState = Schema.Struct({
  visible: Schema.Boolean.annotate({ title: "Zobrazit" }),
  label: Schema.String.annotate({ title: "Text", description: "Krátký název pořadu" }),
})

const Logo = ({ state }: FeatureViewProps<typeof LogoState.Type>) => (
  <div
    style={{
      position: "absolute",
      top: 60,
      right: 80,
      display: "flex",
      alignItems: "center",
      gap: 14,
      padding: "12px 22px",
      borderRadius: 14,
      background: "rgba(10,10,14,.75)",
      color: "white",
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: 30,
      fontWeight: 800,
      letterSpacing: 1,
      opacity: state.visible ? 1 : 0,
      transition: "opacity 500ms",
    }}
  >
    <svg width="34" height="34" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#e5383b" />
      <circle cx="12" cy="12" r="4" fill="white" />
    </svg>
    {state.label}
  </div>
)

export const logo = Feature.make({
  label: "Logo",
  description: "Logo pořadu v rohu obrazu",
  state: LogoState,
  initial: { visible: true, label: "DEMO SHOW" },
  view: Logo,
})
