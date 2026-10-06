import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/_index.tsx"),
  route("sign-in", "routes/sign-in.tsx"),
  route("dashboard", "routes/dashboard.tsx"),
  route("dashboard/deployments/new", "routes/dashboard.deployments.new.tsx"),
  route("dashboard/deployments/:id", "routes/dashboard.deployments.$id.tsx"),
  route("dashboard/databases", "routes/dashboard.databases.tsx"),
  route("dashboard/databases/new", "routes/dashboard.databases.new.tsx"),
  route("dashboard/databases/:id", "routes/dashboard.databases.$id.tsx"),
] satisfies RouteConfig;
