import type { Database, DatabaseBackup, Deployment } from '@hangar/types';

interface StatusStyle {
	label: string;
	dot: string;
	text: string;
	ring: string;
	glyph: string;
	pulse?: boolean;
}

export const STATUS: Record<string, StatusStyle> = {
	pending: {
		label: 'Queued',
		dot: 'bg-steel-400',
		text: 'text-steel-300',
		ring: 'border-steel-500/40',
		glyph: 'text-steel-500',
		pulse: true,
	},
	building: {
		label: 'Building',
		dot: 'bg-deck-400',
		text: 'text-deck-300',
		ring: 'border-deck-400/40',
		glyph: 'text-deck-400',
		pulse: true,
	},
	deploying: {
		label: 'Deploying',
		dot: 'bg-deck-300',
		text: 'text-deck-300',
		ring: 'border-deck-300/40',
		glyph: 'text-deck-300',
		pulse: true,
	},
	running: {
		label: 'Running',
		dot: 'bg-signal-400',
		text: 'text-signal-400',
		ring: 'border-signal-400/40',
		glyph: 'text-signal-400',
	},
	failed: {
		label: 'Failed',
		dot: 'bg-alarm-400',
		text: 'text-alarm-400',
		ring: 'border-alarm-400/40',
		glyph: 'text-alarm-400',
	},
	provisioning: {
		label: 'Provisioning',
		dot: 'bg-deck-400',
		text: 'text-deck-300',
		ring: 'border-deck-400/40',
		glyph: 'text-deck-400',
		pulse: true,
	},
	ready: {
		label: 'Ready',
		dot: 'bg-signal-400',
		text: 'text-signal-400',
		ring: 'border-signal-400/40',
		glyph: 'text-signal-400',
	},
	degraded: {
		label: 'Degraded',
		dot: 'bg-deck-300',
		text: 'text-deck-300',
		ring: 'border-deck-300/40',
		glyph: 'text-deck-300',
	},
	deleting: {
		label: 'Deleting',
		dot: 'bg-steel-400',
		text: 'text-steel-300',
		ring: 'border-steel-500/40',
		glyph: 'text-steel-500',
		pulse: true,
	},
	attaching: {
		label: 'Attaching',
		dot: 'bg-deck-400',
		text: 'text-deck-300',
		ring: 'border-deck-400/40',
		glyph: 'text-deck-400',
		pulse: true,
	},
	attached: {
		label: 'Attached',
		dot: 'bg-steel-400',
		text: 'text-steel-300',
		ring: 'border-steel-500/40',
		glyph: 'text-steel-500',
	},
	detaching: {
		label: 'Detaching',
		dot: 'bg-steel-400',
		text: 'text-steel-300',
		ring: 'border-steel-500/40',
		glyph: 'text-steel-500',
		pulse: true,
	},
	'backing-up': {
		label: 'Backing up',
		dot: 'bg-deck-400',
		text: 'text-deck-300',
		ring: 'border-deck-400/40',
		glyph: 'text-deck-400',
		pulse: true,
	},
	complete: {
		label: 'Complete',
		dot: 'bg-steel-400',
		text: 'text-steel-300',
		ring: 'border-steel-500/40',
		glyph: 'text-steel-500',
	},
	stopped: {
		label: 'Stopped',
		dot: 'bg-steel-500',
		text: 'text-steel-400',
		ring: 'border-steel-500/40',
		glyph: 'text-steel-500',
	},
};

export function statusOf(status: string): StatusStyle {
	return STATUS[status] ?? STATUS.pending;
}

export const ACTIVE_BUILD_STATUSES = ['building', 'deploying'];

export function deploymentStatus(d: Pick<Deployment, 'status' | 'latestBuild'>): string {
	const build = d.latestBuild?.status;
	if (d.status === 'stopped' && build === 'running') return 'stopped';
	return build ?? d.status;
}

export const ACTIVE_DATABASE_STATUSES = ['provisioning', 'deleting'];

export function databaseStatus(d: Pick<Database, 'status'>): string {
	return d.status;
}

export function backupStatus(b: Pick<DatabaseBackup, 'status'>): string {
	if (b.status === 'running') return 'backing-up';
	if (b.status === 'completed') return 'complete';
	return 'failed';
}

export const ACTIVE_ATTACHMENT_STATUSES = ['attaching', 'detaching'];
