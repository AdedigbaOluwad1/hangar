// apps/web/app/routes/dashboard.tsx
import { useRef } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { PlusSignIcon } from '@hugeicons/core-free-icons';
import type { Route } from './+types/dashboard';
import { api } from '../lib/api';
import { useCountUp, useReveal } from '../lib/motion';
import { cn } from '../lib/utils';
import { Header } from '../components/header';
import { DeploymentList } from '../components/deployment-list';
import { buttonVariants } from '../components/ui/button';
import { ACTIVE_BUILD_STATUSES, deploymentStatus } from '../lib/status';

export function meta({}: Route.MetaArgs) {
	return [{ title: 'Deployments · Hangar' }];
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
	const ref = useRef<HTMLSpanElement>(null);
	useCountUp(ref, value);
	return (
		<div data-reveal className="border-l border-line pl-4">
			<span ref={ref} className={cn('display block text-4xl tabular-nums md:text-5xl', tone)}>
				{value}
			</span>
			<span className="mt-1.5 block font-code text-[10px] uppercase tracking-[0.2em] text-steel-500">{label}</span>
		</div>
	);
}

export default function Dashboard() {
	const scope = useRef<HTMLDivElement>(null);
	const {
		data: deployments = [],
		isLoading,
		isError,
		error,
	} = useQuery({
		queryKey: ['deployments'],
		queryFn: api.listDeployments,
		refetchInterval: (query) => {
			const hasActive = query.state.data?.some((d) =>
				['pending', ...ACTIVE_BUILD_STATUSES].includes(deploymentStatus(d)),
			);
			return hasActive ? 2000 : 10000;
		},
	});
	useReveal(scope, !isLoading);

	const count = (statuses: string[]) => deployments.filter((d) => statuses.includes(deploymentStatus(d))).length;

	return (
		<div ref={scope} className="relative min-h-screen">
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-x-0 top-0 h-[420px] overflow-hidden [mask-image:linear-gradient(to_bottom,black,transparent)]"
			>
				<div className="blueprint-grid absolute inset-0 opacity-60" />
				<div className="absolute -top-40 left-1/2 h-80 w-[60%] -translate-x-1/2 rounded-full bg-deck-400/10 blur-3xl" />
			</div>

			<Header
				action={
					<Link to="/deployments/new" className={buttonVariants({ size: 'sm' })}>
						<HugeiconsIcon icon={PlusSignIcon} className="h-3.5 w-3.5" />
						New deployment
					</Link>
				}
			/>

			<main className="relative mx-auto max-w-6xl px-5 pb-20 pt-12 md:px-8 md:pt-16">
				<div className="flex flex-col gap-10 md:flex-row md:items-end md:justify-between">
					<div>
						<p className="eyebrow">Flight deck</p>
						<h1 className="display mt-4 text-6xl md:text-8xl">Deployments</h1>
					</div>
					<div className="grid grid-cols-4 gap-4 md:gap-8">
						<Stat label="Running" value={count(['running'])} tone="text-signal-400" />
						<Stat label="In flight" value={count(['pending', ...ACTIVE_BUILD_STATUSES])} tone="text-deck-400" />
						<Stat label="Failed" value={count(['failed'])} tone="text-alarm-400" />
						<Stat label="Total" value={deployments.length} tone="text-steel-100" />
					</div>
				</div>

				<div className="mt-12">
					{isError ? (
						<div className="panel border-alarm-400/30 px-6 py-10">
							<p className="eyebrow text-alarm-400!">No contact</p>
							<p className="mt-3 text-steel-100">The dashboard can't reach the Hangar API.</p>
							<p className="mt-1 font-code text-xs text-steel-500">
								{error instanceof Error ? error.message : 'Request failed'}
							</p>
						</div>
					) : isLoading ? (
						<div className="panel divide-y divide-line">
							{[0, 1, 2].map((i) => (
								<div key={i} className="flex items-center gap-4 px-5 py-4">
									<div className="h-7 w-5 animate-pulse rounded bg-night-700" />
									<div className="flex-1 space-y-2">
										<div className="h-3.5 w-48 animate-pulse rounded bg-night-700" />
										<div className="h-2.5 w-72 animate-pulse rounded bg-night-800" />
									</div>
								</div>
							))}
						</div>
					) : (
						<DeploymentList deployments={deployments} />
					)}
				</div>
			</main>
		</div>
	);
}
