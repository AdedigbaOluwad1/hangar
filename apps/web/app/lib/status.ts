// apps/web/app/lib/status.ts
import type { Deployment } from '@hangar/types';

interface StatusStyle {
	label: string;
	dot: string;
	text: string;
	ring: string;
	pulse?: boolean;
}

// amber while it's being built, green once it's airborne, red when it isn't
export const STATUS: Record<string, StatusStyle> = {
	pending: { label: 'Queued', dot: 'bg-steel-400', text: 'text-steel-300', ring: 'border-steel-500/40', pulse: true },
	building: { label: 'Building', dot: 'bg-deck-400', text: 'text-deck-300', ring: 'border-deck-400/40', pulse: true },
	deploying: { label: 'Deploying', dot: 'bg-deck-300', text: 'text-deck-300', ring: 'border-deck-300/40', pulse: true },
	running: { label: 'Running', dot: 'bg-signal-400', text: 'text-signal-400', ring: 'border-signal-400/40' },
	failed: { label: 'Failed', dot: 'bg-alarm-400', text: 'text-alarm-400', ring: 'border-alarm-400/40' },
	stopped: { label: 'Stopped', dot: 'bg-steel-500', text: 'text-steel-400', ring: 'border-steel-500/40' },
};

export function statusOf(status: string): StatusStyle {
	return STATUS[status] ?? STATUS.pending;
}

export const ACTIVE_BUILD_STATUSES = ['building', 'deploying'];

// The latest build says more than the deployment while a build is in flight,
// but stopping a deployment used to leave its serving build marked running,
// and a stopped deployment can't be running.
export function deploymentStatus(d: Pick<Deployment, 'status' | 'latestBuild'>): string {
	const build = d.latestBuild?.status;
	if (d.status === 'stopped' && build === 'running') return 'stopped';
	return build ?? d.status;
}
