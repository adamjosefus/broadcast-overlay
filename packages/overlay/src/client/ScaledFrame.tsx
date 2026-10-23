import { type ReactNode, useLayoutEffect, useRef, useState } from "react"
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "./SceneCanvas.tsx"

/** Fits a 1920×1080 canvas into the available width. */
export const ScaledFrame = ({ children }: { readonly children: ReactNode }) => {
  const ref = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0)

  useLayoutEffect(() => {
    const element = ref.current
    if (element === null) {
      return
    }
    const observer = new ResizeObserver(([entry]) => {
      if (entry !== undefined) {
        setScale(entry.contentRect.width / CANVAS_WIDTH)
      }
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className="checkerboard relative w-full overflow-hidden rounded-lg border"
      style={{ aspectRatio: "16 / 9" }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: CANVAS_WIDTH,
          height: CANVAS_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: "0 0",
        }}
      >
        {children}
      </div>
    </div>
  )
}
