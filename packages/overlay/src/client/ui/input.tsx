import type { ComponentProps } from "react"
import { cn } from "../lib/cn.ts"

export const inputClassName =
  "flex h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive md:text-sm"

export const Input = ({ className, ...props }: ComponentProps<"input">) => (
  <input data-slot="input" className={cn(inputClassName, className)} {...props} />
)

export const Textarea = ({ className, ...props }: ComponentProps<"textarea">) => (
  <textarea
    data-slot="textarea"
    className={cn(inputClassName, "min-h-20 py-2 font-mono", className)}
    {...props}
  />
)

export const NativeSelect = ({ className, ...props }: ComponentProps<"select">) => (
  <select data-slot="select" className={cn(inputClassName, className)} {...props} />
)
