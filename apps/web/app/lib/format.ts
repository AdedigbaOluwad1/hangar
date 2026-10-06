export function formatRelativeTime(iso: string): string {
	const diffMs = Date.now() - new Date(iso).getTime();
	const diffSec = Math.round(diffMs / 1000);

	if (diffSec < 5) return 'just now';
	if (diffSec < 60) return `${diffSec}s ago`;

	const diffMin = Math.round(diffSec / 60);
	if (diffMin < 60) return `${diffMin}m ago`;

	const diffHr = Math.round(diffMin / 60);
	if (diffHr < 24) return `${diffHr}h ago`;

	const diffDay = Math.round(diffHr / 24);
	if (diffDay < 30) return `${diffDay}d ago`;

	return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function shortId(id: string, length = 8): string {
	return id.length > length ? id.slice(0, length) : id;
}

export function repoName(url: string | null | undefined): string | null {
	if (!url) return null;
	const path = url
		.replace(/^[a-z+]+:\/\//i, '')
		.replace(/^git@[^:]+:/, '')
		.replace(/\.git$/, '')
		.replace(/\/$/, '');
	const parts = path.split('/').filter(Boolean);
	return parts.length >= 3 ? parts.slice(-2).join('/') : (parts.slice(-1)[0] ?? null);
}

export function formatBytes(bytes: number | null | undefined): string {
	if (bytes === null || bytes === undefined) return '—';
	const units = ['B', 'KB', 'MB', 'GB', 'TB'];
	let value = bytes;
	let unit = 0;
	while (value >= 1024 && unit < units.length - 1) {
		value /= 1024;
		unit += 1;
	}
	return `${value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}
