import { cn } from '../lib/utils';
import { statusOf } from '../lib/status';

export function StatusBadge({ status, className }: { status: string; className?: string }) {
	const s = statusOf(status);
	return (
		<span
			className={cn(
				'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-code text-micro uppercase tracking-wider',
				s.ring,
				s.text,
				className,
			)}
		>
			<span className="relative flex h-1.5 w-1.5">
				{s.pulse && (
					<span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${s.dot} opacity-60`} />
				)}
				<span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${s.dot}`} />
			</span>
			{s.label}
		</span>
	);
}
