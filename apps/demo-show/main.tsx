import { App } from "overlay"
import { logo } from "./src/features/logo.tsx"
import { lowerThird } from "./src/features/lowerThird.tsx"

const app = new App({ title: "Demo Show", server: { port: 4000 } })
  .defineFeatures({ logo, lowerThird })
  .defineScenes({
    main: { label: "Hlavní scéna", features: ["logo", "lowerThird"] },
    pause: { label: "Přestávka", features: ["logo"] },
  })

await app.start()
