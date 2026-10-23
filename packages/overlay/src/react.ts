import { Option } from "effect"
import { useCallback, useEffect, useState } from "react"
import type { StatefulProps } from "./definition.tsx"

export type TransitionPhase = "idle" | "running"

export interface Transition<S> {
  /** The state being shown (target of a running transition). */
  readonly current: S
  /** Snapshot of the previous state, kept until the transition is done. */
  readonly previous: Option.Option<S>
  readonly phase: TransitionPhase
  /** Grows with every transition; use it as a `key` to restart CSS animations. */
  readonly generation: number
  /** Ends the transition early, e.g. from `onAnimationEnd`. */
  readonly done: () => void
}

interface TransitionState<S> {
  readonly current: S
  readonly previous: Option.Option<S>
  readonly phase: TransitionPhase
  readonly generation: number
  readonly epoch: number
}

export interface TransitionOptions {
  /** Time after which the transition ends on its own, in milliseconds. */
  readonly duration: number
}

/**
 * Implements the state contract of features and components:
 * - a state with a new reference starts a transition from the previous one,
 *   a state arriving mid-transition restarts it from the last target,
 * - a new force epoch drops any transition and shows the state immediately.
 */
export const useStateTransition = <S>(
  { state, force }: StatefulProps<S>,
  { duration }: TransitionOptions,
): Transition<S> => {
  const [transition, setTransition] = useState<TransitionState<S>>(() => ({
    current: state,
    previous: Option.none(),
    phase: "idle",
    generation: 0,
    epoch: force.epoch,
  }))

  const next: TransitionState<S> =
    force.epoch !== transition.epoch
      ? {
          current: state,
          previous: Option.none(),
          phase: "idle",
          generation: transition.generation + 1,
          epoch: force.epoch,
        }
      : state !== transition.current
        ? {
            current: state,
            previous: Option.some(transition.current),
            phase: "running",
            generation: transition.generation + 1,
            epoch: force.epoch,
          }
        : transition

  if (next !== transition) {
    setTransition(next)
  }

  const { phase, generation } = next

  // Ends only the transition it was started for; a newer one keeps running.
  const finish = useCallback(
    (finished: number) =>
      setTransition((current) =>
        current.generation === finished ? { ...current, previous: Option.none(), phase: "idle" } : current,
      ),
    [],
  )

  useEffect(() => {
    if (phase !== "running") {
      return
    }
    const timer = setTimeout(() => finish(generation), duration)
    return () => clearTimeout(timer)
  }, [phase, generation, duration, finish])

  const done = useCallback(() => finish(generation), [finish, generation])

  return { current: next.current, previous: next.previous, phase, generation, done }
}
