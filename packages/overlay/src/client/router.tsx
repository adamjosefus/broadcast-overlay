import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Outlet,
} from "@tanstack/react-router"
import { Broadcast } from "./routes/Broadcast.tsx"

const rootRoute = createRootRoute({ component: Outlet })

const scenesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: lazyRouteComponent(() => import("./routes/SceneList.tsx")),
})

export const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/scene/$sceneId",
  component: lazyRouteComponent(() => import("./routes/Dashboard.tsx")),
})

export const broadcastRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/scene/$sceneId/broadcast",
  component: Broadcast,
})

export const router = createRouter({
  routeTree: rootRoute.addChildren([scenesRoute, dashboardRoute, broadcastRoute]),
})

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}
