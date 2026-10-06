export const paths = {
	signIn: '/sign-in',
	dashboard: '/dashboard',
	newDeployment: '/dashboard/deployments/new',
	deployment: (id: string) => `/dashboard/deployments/${id}`,
	databases: '/dashboard/databases',
	newDatabase: '/dashboard/databases/new',
	database: (id: string) => `/dashboard/databases/${id}`,
} as const;
