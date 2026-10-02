// apps/web/app/components/log-stream.tsx
import { useEffect, useRef } from 'react';
import type { LogLine } from '../lib/use-log-stream';
import { shortId } from '../lib/format';

const STREAM_COLORS: Record<string, string> = {
	build: 'text-deck-400',
	deploy: 'text-signal-400',
	system: 'text-steel-500',
};

export function LogStream({ lines, done, buildId }: { lines: LogLine[]; done: boolean; buildId?: string | null }) {
	const scroller = useRef<HTMLDivElement>(null);

	// follow the tail inside the panel without dragging the page along
	useEffect(() => {
		const el = scroller.current;
		if (el) el.scrollTop = el.scrollHeight;
	}, [lines]);

	return (
		<div className="panel overflow-hidden bg-night-900/95">
			<div className="flex items-center justify-between border-b border-line px-4 py-3">
				<p className="font-code text-[11px] text-steel-500">
					build <span className="text-steel-100">{buildId ? shortId(buildId) : 'latest'}</span>
				</p>
				{done ? (
					<span className="font-code text-[10px] uppercase tracking-wider text-steel-500">Stream closed</span>
				) : (
					<span className="inline-flex items-center gap-1.5 rounded-full border border-signal-400/40 px-2 py-0.5 font-code text-[10px] uppercase tracking-wider text-signal-400">
						<span className="relative flex h-1.5 w-1.5">
							<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal-400 opacity-60" />
							<span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-signal-400" />
						</span>
						Live
					</span>
				)}
			</div>
			<div
				ref={scroller}
				role="log"
				aria-live="polite"
				aria-label="Build log"
				className="h-[420px] overflow-y-auto px-4 py-3 font-code text-[11.5px] leading-relaxed text-steel-300"
			>
				{lines.length === 0 && !done && <span className="text-steel-500">Waiting for the first log line…</span>}
				{lines.length === 0 && done && <span className="text-steel-500">No logs for this build.</span>}
				{lines.map((l, i) => (
					<div key={i} className="log-line flex gap-3">
						<span className={`w-12 shrink-0 ${STREAM_COLORS[l.stream] ?? 'text-steel-500'}`}>{l.stream}</span>
						<span className="min-w-0 whitespace-pre-wrap break-words">{l.line}</span>
					</div>
				))}
			</div>
			<p className="border-t border-line px-4 py-2.5 font-code text-[10px] text-steel-500">
				Streamed over SSE from Redis pub/sub
			</p>
		</div>
	);
}
