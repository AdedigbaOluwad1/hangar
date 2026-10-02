import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft01Icon, ExternalLinkIcon, GitBranchIcon } from '@hugeicons/core-free-icons';
import type { Route } from './+types/dashboard.deployments.$id';
import { api } from '../lib/api';
import { useLogStream } from '../lib/use-log-stream';
import { useReveal } from '../lib/motion';
import { paths } from '../lib/paths';
import { shortId } from '../lib/format';
import { ACTIVE_BUILD_STATUSES, deploymentStatus } from '../lib/status';
import { Header } from '../components/header';
import { StatusBadge } from '../components/status-badge';
import { BuildList } from '../components/build-list';
import { LogStream } from '../components/log-stream';
import { DeploymentActions } from '../components/deployment-actions';
import { CopyButton } from '../components/copy-button';
import { FlightPath } from '../components/flight-path';
import { CallsignTitle } from '../components/callsign-title';

export function meta({ params }: Route.MetaArgs) {
	return [{ title: `${params.id} · Hangar` }];
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div className="min-w-0">
			<dt className="font-code text-[10px] uppercase tracking-[0.2em] text-steel-500">{label}</dt>
			<dd className="mt-1.5 truncate text-sm text-steel-300">{children}</dd>
		</div>
	);
}

export default function DeploymentDetail() {
	const { id } = useParams<{ id: string }>();
	const deploymentId = id!;
	const scope = useRef<HTMLDivElement>(null);
	const [selectedBuildId, setSelectedBuildId] = useState<string | null>(null);

	const { data: deployment, isError } = useQuery({
		queryKey: ['deployment', deploymentId],
		queryFn: () => api.getDeployment(deploymentId),
		refetchInterval: (query) =>
			['pending', ...ACTIVE_BUILD_STATUSES].includes(query.state.data?.status ?? '') ? 2000 : 10000,
	});

	const { data: builds = [] } = useQuery({
		queryKey: ['builds', deploymentId],
		queryFn: () => api.listBuilds(deploymentId),
		refetchInterval: 5000,
	});

	const { data: health } = useQuery({
		queryKey: ['health', deploymentId],
		queryFn: () => api.getHealth(deploymentId),
		refetchInterval: 5000,
		enabled: deployment?.status === 'running',
	});

	const { lines, done } = useLogStream(deploymentId, selectedBuildId);
	useReveal(scope, !!deployment);

	useEffect(() => {
		if (!selectedBuildId && builds.length > 0) {
			setSelectedBuildId(builds[0].id);
		}
	}, [builds, selectedBuildId]);

	const selectedBuild = builds.find((b) => b.id === selectedBuildId);
	const status = deployment ? deploymentStatus(deployment) : 'pending';
	const live = deployment?.liveUrl && status === 'running';

	return (
		<div ref={scope} className="relative min-h-screen">
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-x-0 top-0 h-[480px] overflow-hidden [mask-image:linear-gradient(to_bottom,black,transparent)]"
			>
				<div className="blueprint-grid absolute inset-0 opacity-50" />
				<div
					className={`absolute -top-40 left-1/3 h-80 w-[50%] rounded-full blur-3xl transition-colors duration-1000 ${live ? 'bg-signal-400/10' : 'bg-deck-400/10'}`}
				/>
			</div>

			<Header />

			<main className="relative mx-auto max-w-6xl px-5 pb-20 pt-10 md:px-8 md:pt-12">
				<Link
					to={paths.dashboard}
					className="inline-flex items-center gap-1.5 font-code text-[11px] uppercase tracking-[0.16em] text-steel-400 transition-colors hover:text-steel-100"
				>
					<HugeiconsIcon icon={ArrowLeft01Icon} className="h-3.5 w-3.5" />
					Deployments
				</Link>

				{isError ? (
					<div className="panel mt-8 px-6 py-10">
						<p className="eyebrow text-alarm-400!">Lost contact</p>
						<p className="mt-3 text-steel-100">This deployment couldn't be loaded.</p>
					</div>
				) : !deployment ? (
					<div className="mt-8 space-y-4">
						<div className="h-16 w-2/3 animate-pulse rounded-lg bg-night-800" />
						<div className="h-32 animate-pulse rounded-xl bg-night-850" />
					</div>
				) : (
					<>
						<div className="mt-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
							<div className="min-w-0">
								<div data-reveal className="flex items-center gap-3">
									<p className="eyebrow">Deployment</p>
									<StatusBadge status={status} />
								</div>
								<div data-reveal className="mt-4">
									<CallsignTitle deployment={deployment} />
								</div>
								<div data-reveal className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1">
									<span className="flex min-w-0 items-center gap-1 font-code text-xs text-steel-500">
										<span className="truncate">{deploymentId}</span>
										<CopyButton value={deploymentId} label="Copy deployment ID" />
									</span>
									{deployment.sourceUrl && (
										<a
											href={deployment.sourceUrl}
											target="_blank"
											rel="noreferrer"
											className="flex min-w-0 items-center gap-1.5 font-code text-xs text-steel-400 transition-colors hover:text-steel-100"
										>
											<HugeiconsIcon icon={GitBranchIcon} className="h-3.5 w-3.5 shrink-0" />
											<span className="truncate">{deployment.sourceUrl.replace(/^https?:\/\//, '')}</span>
										</a>
									)}
								</div>
							</div>
							<div data-reveal>
								<DeploymentActions deploymentId={deploymentId} currentImageTag={deployment.imageTag} status={status} />
							</div>
						</div>

						<div data-reveal className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
							{live ? (
								<a
									href={deployment.liveUrl!}
									target="_blank"
									rel="noreferrer"
									className="group panel flex items-center gap-4 border-signal-400/40 bg-[#0b1c17] px-5 py-5 transition-colors hover:border-signal-400/70"
								>
									<span className="live-dot shrink-0" aria-hidden="true" />
									<span className="min-w-0 flex-1">
										<span className="block font-code text-[10px] uppercase tracking-[0.2em] text-signal-400/80">
											Live
										</span>
										<span className="mt-1 block truncate font-code text-sm text-signal-400">{deployment.liveUrl}</span>
									</span>
									<HugeiconsIcon
										icon={ExternalLinkIcon}
										className="h-4 w-4 shrink-0 text-signal-400 transition-transform duration-300 ease-settle group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
									/>
								</a>
							) : (
								<div className="panel flex items-center gap-4 border-dashed px-5 py-5">
									<span className="h-2 w-2 shrink-0 rounded-full bg-steel-500" aria-hidden="true" />
									<span className="min-w-0">
										<span className="block font-code text-[10px] uppercase tracking-[0.2em] text-steel-500">
											Live URL
										</span>
										<span className="mt-1 block text-sm text-steel-400">
											{status === 'failed'
												? 'Grounded. Check the log below.'
												: status === 'stopped'
													? 'Stood down.'
													: 'Not airborne yet. Caddy opens the route once Consul reports healthy.'}
										</span>
									</span>
								</div>
							)}
							<dl className="panel grid grid-cols-3 gap-4 px-5 py-5">
								<Fact label="Image">
									<code className="font-code text-xs">
										{deployment.imageTag ? `:${shortId(deployment.imageTag.split(':').pop() ?? '', 13)}` : '—'}
									</code>
								</Fact>
								<Fact label="Alloc">{health?.status ?? '—'}</Fact>
								<Fact label="Created">
									{new Date(deployment.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
								</Fact>
							</dl>
						</div>

						<div data-reveal className="mt-4">
							<FlightPath
								lines={lines}
								status={selectedBuild?.id === deployment.latestBuild?.id ? status : selectedBuild?.status}
							/>
						</div>

						<div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-[280px_minmax(0,1fr)]">
							<section data-reveal aria-labelledby="builds-title">
								<h2 id="builds-title" className="eyebrow mb-3">
									Flight log
								</h2>
								<BuildList builds={builds} selectedBuildId={selectedBuildId} onSelect={setSelectedBuildId} />
							</section>
							<section data-reveal aria-labelledby="logs-title">
								<h2 id="logs-title" className="eyebrow mb-3">
									Logs
								</h2>
								<LogStream lines={lines} done={done} buildId={selectedBuildId} />
							</section>
						</div>
					</>
				)}
			</main>
		</div>
	);
}
