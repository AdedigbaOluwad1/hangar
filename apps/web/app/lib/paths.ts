export const paths = {
	dashboard: '/dashboard',
	newDeployment: '/dashboard/deployments/new',
	deployment: (id: string) => `/dashboard/deployments/${id}`,
} as const;
