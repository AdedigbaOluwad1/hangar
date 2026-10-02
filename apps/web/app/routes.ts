import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/_index.tsx"),
  route("dashboard", "routes/dashboard.tsx"),
  route("deployments/:id", "routes/deployments.$id.tsx"),
] satisfies RouteConfig;
