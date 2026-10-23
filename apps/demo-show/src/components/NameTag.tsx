import { Component, type ComponentViewProps } from "overlay"
import { useStateTransition } from "overlay/react"
import { Option } from "effect"

export interface NameTagProps {
  readonly text: string
  readonly size: number
  readonly weight: number
}

const keyframes = `
@keyframes demo-nametag-in { from { transform: translateY(100%); opacity: 0 } to { transform: none; opacity: 1 } }
@keyframes demo-nametag-out { from { transform: none; opacity: 1 } to { transform: translateY(-100%); opacity: 0 } }
`

const DURATION = 450

/** Text line that slides the old text out and the new one in when it changes. */
const NameTagView = (props: ComponentViewProps<NameTagProps>) => {
  const { current, previous, generation } = useStateTransition(props, { duration: DURATION })
  const style = (state: NameTagProps) => ({
    gridArea: "1 / 1",
    fontSize: state.size,
    fontWeight: state.weight,
    whiteSpace: "nowrap" as const,
  })
  return (
    <div style={{ display: "grid", overflow: "hidden" }}>
      <style>{keyframes}</style>
      {Option.match(previous, {
        onNone: () => null,
        onSome: (old) => (
          <span
            key={`out-${generation}`}
            style={{ ...style(old), animation: `demo-nametag-out ${DURATION}ms ease-in forwards` }}
          >
            {old.text}
          </span>
        ),
      })}
      <span
        key={`in-${generation}`}
        style={{
          ...style(current),
          animation: Option.isSome(previous) ? `demo-nametag-in ${DURATION}ms ease-out both` : "none",
        }}
      >
        {current.text}
      </span>
    </div>
  )
}

export const NameTag = Component.make({ name: "NameTag", view: NameTagView })
