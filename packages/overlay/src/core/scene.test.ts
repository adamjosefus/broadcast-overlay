import { assertEquals, assertStrictEquals } from "@std/assert"
import { Option, Result } from "effect"
import { applyChanges, forceFeature, makeScene } from "./scene.ts"

const scene = makeScene("main", "server-1", { logo: { visible: true }, bar: { text: "a" } })

Deno.test("applyChanges bumps only the changed slot and keeps other references", () => {
  const next = Result.getOrThrow(applyChanges(scene, [{ featureId: "bar", state: { text: "b" } }]))
  assertEquals(next.revision, 1)
  assertEquals(next.features["bar"], { state: { text: "b" }, rev: 1, forceEpoch: 0 })
  assertStrictEquals(next.features["logo"], scene.features["logo"])
})

Deno.test("applyChanges applies grouped changes in one revision", () => {
  const next = Result.getOrThrow(
    applyChanges(scene, [
      { featureId: "bar", state: { text: "b" } },
      { featureId: "logo", state: { visible: false } },
    ]),
  )
  assertEquals(next.revision, 1)
  assertEquals(next.features["logo"]?.rev, 1)
  assertEquals(next.features["bar"]?.rev, 1)
})

Deno.test("applyChanges fails for a feature outside the scene", () => {
  const result = applyChanges(scene, [{ featureId: "nope", state: 1 }])
  assertEquals(Result.isFailure(result), true)
  if (Result.isFailure(result)) {
    assertEquals(result.failure._tag, "FeatureNotInScene")
  }
})

Deno.test("forceFeature bumps the force epoch and keeps state when none is given", () => {
  const next = Result.getOrThrow(forceFeature(scene, "bar", Option.none()))
  assertEquals(next.features["bar"], { state: { text: "a" }, rev: 1, forceEpoch: 1 })
  const withState = Result.getOrThrow(forceFeature(next, "bar", Option.some({ text: "c" })))
  assertEquals(withState.features["bar"], { state: { text: "c" }, rev: 2, forceEpoch: 2 })
})
