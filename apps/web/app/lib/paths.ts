// apps/web/app/lib/paths.ts
//
// Every page behind the dashboard lives under /dashboard. Build links from
// here so a route move is one edit, not a string hunt.
export const paths = {
	dashboard: '/dashboard',
	newDeployment: '/dashboard/deployments/new',
	deployment: (id: string) => `/dashboard/deployments/${id}`,
} as const;
