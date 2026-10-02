// apps/web/app/components/build-list.tsx
import type { Build } from '@hangar/types';
import { StatusBadge } from './status-badge';
import { cn } from '../lib/utils';
import { formatRelativeTime, shortId } from '../lib/format';

const TRIGGER: Record<string, string> = {
	deploy: 'Launch',
	redeploy: 'Redeploy',
	rollback: 'Rollback',
};

export function BuildList({
	builds,
	selectedBuildId,
	onSelect,
}: {
	builds: Build[];
	selectedBuildId: string | null;
	onSelect: (id: string) => void;
}) {
	if (builds.length === 0) {
		return <p className="panel px-4 py-6 text-sm text-steel-500">No builds yet.</p>;
	}

	return (
		<ol className="panel divide-y divide-line overflow-hidden">
			{builds.map((b) => {
				const selected = b.id === selectedBuildId;
				return (
					<li key={b.id}>
						<button
							onClick={() => onSelect(b.id)}
							aria-current={selected ? 'true' : undefined}
							className={cn(
								'relative flex w-full flex-col gap-1.5 px-4 py-3.5 text-left transition-colors duration-300 ease-settle',
								selected ? 'bg-night-850' : 'hover:bg-night-900',
							)}
						>
							<span
								aria-hidden="true"
								className={cn(
									'absolute inset-y-0 left-0 w-0.5 origin-top bg-deck-400 transition-transform duration-500 ease-settle',
									selected ? 'scale-y-100' : 'scale-y-0',
								)}
							/>
							<span className="flex items-center justify-between gap-2">
								<span className="font-display text-base font-bold uppercase tracking-wide text-steel-100">
									{TRIGGER[b.trigger] ?? b.trigger}
								</span>
								<StatusBadge status={b.status} />
							</span>
							<span className="flex items-center gap-1.5 font-code text-[11px] text-steel-500">
								<span>{shortId(b.id)}</span>
								<span aria-hidden>·</span>
								<span>{formatRelativeTime(b.createdAt)}</span>
							</span>
							{b.rollbackOf && (
								<span className="font-code text-[11px] text-deck-300">↩ image from {shortId(b.rollbackOf)}</span>
							)}
						</button>
					</li>
				);
			})}
		</ol>
	);
}
