export type DeploymentStatus =
	| 'pending'
	| 'building'
	| 'deploying'
	| 'running'
	| 'failed';

export interface Deployment {
	id: string;
	status: DeploymentStatus;
	sourceType: 'git' | 'zip';
	sourceUrl: string | null;
	imageTag: string | null;
	containerId: string | null;
	port: number | null;
	liveUrl: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface LogLine {
	deploymentId: string;
	stream: 'build' | 'deploy' | 'system';
	line: string;
	createdAt: string;
}

export interface CreateDeploymentInput {
	sourceType: 'git' | 'zip';
	sourceUrl?: string;
}

export interface ApiResponse<T> {
	data: T;
	error?: string;
}
