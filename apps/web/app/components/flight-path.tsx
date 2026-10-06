import { PIPELINE_LOG } from '@hangar/types';
import type { LogLine } from '../lib/use-log-stream';
import { JetPlan } from '../story/art/jet';
import { cn } from '../lib/utils';

export const FLIGHT_PLAN = [
	{ key: 'clone', label: 'Clone', by: 'git', marker: PIPELINE_LOG.clone },
	{ key: 'detect', label: 'Detect', by: 'Railpack', marker: PIPELINE_LOG.detect },
	{ key: 'build', label: 'Build', by: 'BuildKit', marker: PIPELINE_LOG.build },
	{ key: 'push', label: 'Push', by: 'Registry', marker: PIPELINE_LOG.push },
	{ key: 'schedule', label: 'Schedule', by: 'Nomad', marker: PIPELINE_LOG.schedule },
	{ key: 'route', label: 'Route', by: 'Consul · Caddy', marker: PIPELINE_LOG.route },
	{ key: 'live', label: 'Live', by: 'Airborne', marker: PIPELINE_LOG.live },
] as const;

type StageState = 'done' | 'active' | 'waiting' | 'skipped' | 'failed';

const PUSH = 3;
const SCHEDULE = 4;
const LIVE = FLIGHT_PLAN.length - 1;

function readFlight(lines: LogLine[], status?: string) {
	let reached = -1;
	let rollback = false;
	let failed = status === 'failed';
	let complete = status === 'running';

	for (const { line } of lines) {
		if (line.includes(PIPELINE_LOG.rollback) || line.includes(PIPELINE_LOG.restart)) {
			rollback = true;
			reached = Math.max(reached, SCHEDULE);
		}
		if (line.includes(PIPELINE_LOG.failed)) failed = true;
		if (line.includes(PIPELINE_LOG.complete)) complete = true;
		FLIGHT_PLAN.forEach((stage, i) => {
			if (line.includes(stage.marker)) reached = Math.max(reached, i);
		});
	}

	if (reached === PUSH && !failed) reached = SCHEDULE;
	if (reached === LIVE) complete = true;
	if (reached < 0) reached = status === 'deploying' ? SCHEDULE : 0;

	const states: StageState[] = FLIGHT_PLAN.map((_, i) => {
		if (rollback && i <= PUSH) return 'skipped';
		if (complete) return 'done';
		if (i < reached) return 'done';
		if (i === reached) return failed ? 'failed' : 'active';
		return 'waiting';
	});

	return { states, complete, failed, progress: complete ? 1 : reached / LIVE };
}

const NODE: Record<StageState, string> = {
	done: 'border-deck-400 bg-deck-400',
	active: 'border-deck-400 bg-night-950',
	waiting: 'border-night-600 bg-night-950',
	skipped: 'border-dashed border-steel-500 bg-night-950',
	failed: 'border-alarm-400 bg-alarm-400',
};

export function FlightPath({ lines, status }: { lines: LogLine[]; status?: string }) {
	const { states, complete, failed, progress } = readFlight(lines, status);

	return (
		<div className="panel px-5 pb-5 pt-6 md:px-7">
			<div className="flex items-center justify-between">
				<p className="eyebrow">Flight path</p>
				<p className="font-code text-mono text-steel-500">
					{status === 'stopped' ? 'stood down' : complete ? 'airborne' : failed ? 'aborted' : 'in flight'}
				</p>
			</div>

			<div className="relative mt-7 overflow-x-clip">
				<div className="absolute left-[calc(100%/14)] right-[calc(100%/14)] top-[11px] h-px bg-night-600">
					<div
						className={cn(
							'h-full origin-left motion-safe:transition-[transform,background-color] motion-safe:duration-slow motion-safe:ease-settle',
							complete ? 'bg-signal-400' : failed ? 'bg-alarm-400' : 'bg-deck-400',
						)}
						style={{ transform: `scaleX(${progress})` }}
					/>
					<div
						aria-hidden="true"
						className={cn(
							'absolute inset-x-0 -top-[40px] motion-safe:transition-[transform,opacity] motion-safe:duration-slow',
							complete ? 'opacity-0 motion-safe:ease-throttle' : 'opacity-100 motion-safe:ease-settle',
						)}
						style={{ transform: `translateX(${(complete ? 1.15 : progress) * 100}%)` }}
					>
						<JetPlan
							className={cn('h-6 w-[18px] -translate-x-1/2 rotate-90', failed ? 'text-alarm-400' : 'text-deck-400')}
						/>
					</div>
				</div>

				<ol className="relative grid grid-cols-7">
					{FLIGHT_PLAN.map((stage, i) => {
						const state = states[i];
						const isLive = i === LIVE && state === 'done';
						return (
							<li key={stage.key} className="flex flex-col items-center text-center">
								<span
									className={cn(
										'relative flex h-[23px] w-[23px] items-center justify-center rounded-full border-2 motion-safe:transition-colors motion-safe:duration-base',
										isLive ? 'border-signal-400 bg-signal-400' : NODE[state],
									)}
								>
									{state === 'active' && (
										<span className="absolute inset-0 rounded-full border-2 border-deck-400 motion-safe:animate-ping" />
									)}
									{state === 'done' && (
										<svg viewBox="0 0 12 12" className="h-2.5 w-2.5" aria-hidden="true">
											<path d="M2 6.5 L5 9 L10 3" fill="none" strokeWidth="2" className="stroke-night-950" />
										</svg>
									)}
								</span>
								<span
									className={cn(
										'mt-3 font-display text-mono font-bold uppercase tracking-normal sm:text-sm sm:tracking-wide md:text-base',
										state === 'waiting' || state === 'skipped' ? 'text-steel-500' : 'text-steel-100',
										isLive && 'text-signal-400',
										state === 'failed' && 'text-alarm-400',
									)}
								>
									{stage.label}
								</span>
								<span className="mt-0.5 hidden font-code text-micro text-steel-500 sm:block">
									{state === 'skipped' ? 'skipped' : stage.by}
								</span>
								<span className="sr-only">{state}</span>
							</li>
						);
					})}
				</ol>
			</div>
		</div>
	);
}
