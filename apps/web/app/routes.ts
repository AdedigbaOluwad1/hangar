import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/_index.tsx"),
  route("dashboard", "routes/dashboard.tsx"),
  route("dashboard/deployments/new", "routes/dashboard.deployments.new.tsx"),
  route("dashboard/deployments/:id", "routes/dashboard.deployments.$id.tsx"),
] satisfies RouteConfig;
