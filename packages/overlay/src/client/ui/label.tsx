import type { ComponentProps } from "react"
import { cn } from "../lib/cn.ts"

export const Label = ({ className, ...props }: ComponentProps<"label">) => (
  <label
    data-slot="label"
    className={cn("flex select-none items-center gap-2 text-sm font-medium leading-none", className)}
    {...props}
  />
)
