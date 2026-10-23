import { Equal, Option, Result, Schema } from "effect"
import { type ComponentType, useEffect, useMemo, useState } from "react"
import { InvalidFeatureState } from "./core/errors.ts"

/** Signal of a forced state change; a new `epoch` means "jump to `state` now". */
export interface ForceSignal {
  readonly epoch: number
}

/** Props shared by features and components: they receive state, never own it. */
export interface StatefulProps<S> {
  /** Current state. A new reference starts a transition from the previous one. */
  readonly state: S
  /** Changes on `setStateForce`: drop any transition and show `state` immediately. */
  readonly force: ForceSignal
}

export type FeatureViewProps<V> = StatefulProps<V>
export type ComponentViewProps<P> = StatefulProps<P>

/** A feature schema: must be serializable without extra services. */
export type FeatureSchema<A, I> = Schema.Codec<A, I, never, never>

/** Props of the type-erased renderer used by the library's own views. */
export interface FeatureRendererProps {
  /** Encoded state as it arrived from the server (stable reference per revision). */
  readonly encoded: unknown
  readonly forceEpoch: number
}

/** Type-erased operations, so features with different state types can live in one registry. */
export interface ErasedFeature {
  /** Validates an unknown value and returns its normalized encoded form. */
  readonly normalize: (input: unknown) => Result.Result<unknown, InvalidFeatureState>
  readonly initialEncoded: () => Result.Result<unknown, InvalidFeatureState>
  readonly Renderer: ComponentType<FeatureRendererProps>
}

export interface Feature<A, I> {
  readonly _tag: "Feature"
  readonly label: string
  readonly description: Option.Option<string>
  readonly schema: FeatureSchema<A, I>
  readonly initial: A
  readonly components: ReadonlyArray<AnyComponent>
  readonly erased: ErasedFeature
}

export type AnyFeature = Feature<unknown, unknown>

interface FeatureDefinitionBase<A, I> {
  readonly label: string
  readonly description?: string
  /** Effect Schema of the feature state; types, validation and the editor form derive from it. */
  readonly state: FeatureSchema<A, I>
  readonly initial: NoInfer<A>
  readonly components?: ReadonlyArray<AnyComponent>
}

export interface SelectedFeatureDefinition<A, I, V> extends FeatureDefinitionBase<A, I> {
  /** Transforms the state into the shape the view needs. Memoized by reference. */
  readonly select: (state: A) => V
  readonly view: ComponentType<FeatureViewProps<V>>
}

export interface PlainFeatureDefinition<A, I> extends FeatureDefinitionBase<A, I> {
  readonly select?: undefined
  readonly view: ComponentType<FeatureViewProps<NoInfer<A>>>
}

export type FeatureDefinition<A, I, V> = SelectedFeatureDefinition<A, I, V> | PlainFeatureDefinition<A, I>

/**
 * Returns the previous reference while the value stays structurally equal, so a
 * transition only starts when the value really changed (e.g. a `select` that
 * builds new objects on every state change).
 */
const useStableReference = <T,>(value: T): T => {
  const [stable, setStable] = useState(value)
  if (stable === value || Equal.equals(stable, value)) {
    return stable
  }
  setStable(value)
  return value
}

const invalidState = (featureId: string) => (error: Schema.SchemaError) =>
  new InvalidFeatureState({ featureId, message: error.message })

const makeFeature = <A, I, V>(
  definition: FeatureDefinitionBase<A, I>,
  select: (state: A) => V,
  View: ComponentType<FeatureViewProps<V>>,
): Feature<A, I> => {
  const schema = definition.state
  const label = definition.label
  const decode = Schema.decodeUnknownResult(schema)
  const encode = Schema.encodeResult(schema)

  const Renderer = ({ encoded, forceEpoch }: FeatureRendererProps) => {
    const decoded = useMemo(() => decode(encoded), [encoded])
    const selected = useMemo(() => Result.map(decoded, select), [decoded])
    const force = useMemo<ForceSignal>(() => ({ epoch: forceEpoch }), [forceEpoch])
    useEffect(() => {
      if (Result.isFailure(decoded)) {
        console.error(`[overlay] Invalid state of feature "${label}":`, decoded.failure.message)
      }
    }, [decoded])
    return Result.isSuccess(selected) ? <StableView state={selected.success} force={force} /> : null
  }
  const StableView = ({ state, force }: FeatureViewProps<V>) => (
    <View state={useStableReference(state)} force={force} />
  )
  Renderer.displayName = `Feature(${label})`

  return {
    _tag: "Feature",
    label,
    description: Option.fromNullishOr(definition.description),
    schema,
    initial: definition.initial,
    components: definition.components ?? [],
    erased: {
      normalize: (input) => decode(input).pipe(Result.flatMap(encode), Result.mapError(invalidState(label))),
      initialEncoded: () => encode(definition.initial).pipe(Result.mapError(invalidState(label))),
      Renderer,
    },
  }
}

function make<A, I, V>(definition: SelectedFeatureDefinition<A, I, V>): Feature<A, I>
function make<A, I>(definition: PlainFeatureDefinition<A, I>): Feature<A, I>
function make<A, I, V>(definition: FeatureDefinition<A, I, V>): Feature<A, I> {
  return definition.select === undefined
    ? makeFeature(definition, (state: A) => state, definition.view)
    : makeFeature(definition, definition.select, definition.view)
}

export const Feature = {
  /** Defines a feature. Its state type is inferred from the `state` schema. */
  make,
}

export interface Component<P> {
  readonly _tag: "Component"
  readonly name: string
  readonly View: ComponentType<ComponentViewProps<P>>
}

export interface AnyComponent {
  readonly _tag: "Component"
  readonly name: string
}

export const Component = {
  /** Defines a reusable visual component. It owns no domain state; it gets it from a feature. */
  make: <P,>(definition: {
    readonly name: string
    readonly view: ComponentType<ComponentViewProps<P>>
  }): Component<P> => {
    const View = definition.view
    const Named = ({ state, force }: ComponentViewProps<P>) => (
      <View state={useStableReference(state)} force={force} />
    )
    Named.displayName = definition.name
    return { _tag: "Component", name: definition.name, View: Named }
  },
}
