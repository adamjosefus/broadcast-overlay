import type { AnyFeature } from "./definition.tsx"

export interface SceneDefinition<K extends string> {
  readonly label: string
  /** Features that belong to the scene. All of them are mounted on its broadcast page. */
  readonly features: ReadonlyArray<K>
}

export interface ServerConfig {
  /** Port of the web app (dashboard and broadcast pages). Defaults to 4000. */
  readonly port?: number
  /** Interface to listen on. Defaults to "0.0.0.0", so the app is reachable from the LAN. */
  readonly host?: string
}

export interface AppConfig {
  readonly title?: string
  readonly server?: ServerConfig
}

export interface StartOptions {
  /**
   * Module that defines the app and is bundled for the browser. Defaults to the
   * Deno main module. It must not import server-only code at the top level.
   */
  readonly entry?: string | URL
}

/** Type-erased, immutable description of the whole app. */
export interface AppDefinition {
  readonly config: AppConfig
  readonly features: Readonly<Record<string, AnyFeature>>
  readonly scenes: Readonly<Record<string, SceneDefinition<string>>>
}

type FeatureMap = Readonly<Record<string, AnyFeature>>
type SceneMap = Readonly<Record<string, SceneDefinition<string>>>
type Empty = Record<never, never>

/**
 * Entry point of the library. An immutable builder: every `define*` call returns
 * a new `App` whose type carries the feature and scene identifiers.
 */
export class App<F extends FeatureMap = Empty, S extends SceneMap = Empty> {
  readonly definition: AppDefinition

  constructor(config: AppConfig = {}, definition?: AppDefinition) {
    this.definition = definition ?? { config, features: {}, scenes: {} }
  }

  defineFeatures<const NF extends FeatureMap>(features: NF): App<F & NF, S> {
    return new App<F & NF, S>(this.definition.config, {
      ...this.definition,
      features: { ...this.definition.features, ...features },
    })
  }

  defineScenes<const NS extends Readonly<Record<string, SceneDefinition<Extract<keyof F, string>>>>>(
    scenes: NS,
  ): App<F, S & NS> {
    return new App<F, S & NS>(this.definition.config, {
      ...this.definition,
      scenes: { ...this.definition.scenes, ...scenes },
    })
  }

  /**
   * Starts the server with all views. In the browser bundle this only registers
   * the app definition, so the same module can be shared by server and client.
   */
  async start(options: StartOptions = {}): Promise<void> {
    const { start } = await import("./server/start.ts")
    return start(this.definition, options)
  }
}

export type FeatureIdOf<T> = T extends App<infer F, SceneMap> ? Extract<keyof F, string> : never
export type SceneIdOf<T> = T extends App<FeatureMap, infer S> ? Extract<keyof S, string> : never
