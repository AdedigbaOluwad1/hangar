import { useRef } from 'react';
import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons';
import { ENGINES, DATABASE_PLANS, type DatabasePlan } from '@hangar/types';
import type { Route } from './+types/dashboard.databases.$id';
import { api } from '../lib/api';
import { useReveal } from '../lib/motion';
import { paths } from '../lib/paths';
import { formatRelativeTime } from '../lib/format';
import { ACTIVE_DATABASE_STATUSES, databaseStatus } from '../lib/status';
import { Header } from '../components/header';
import { StatusBadge } from '../components/status-badge';
import { CopyButton } from '../components/copy-button';
import { DatabaseActions } from '../components/database-actions';
import { BackupList } from '../components/backup-list';

export function meta({ params }: Route.MetaArgs) {
	return [{ title: `${params.id} · Hangar` }];
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div className="min-w-0">
			<dt className="font-code text-micro uppercase tracking-[0.2em] text-steel-500">{label}</dt>
			<dd className="mt-1.5 truncate text-sm text-steel-300">{children}</dd>
		</div>
	);
}

export default function DatabaseDetail() {
	const { id } = useParams<{ id: string }>();
	const databaseId = id!;
	const scope = useRef<HTMLDivElement>(null);

	const { data: database, isError } = useQuery({
		queryKey: ['database', databaseId],
		queryFn: () => api.getDatabase(databaseId),
		refetchInterval: (query) => (ACTIVE_DATABASE_STATUSES.includes(query.state.data?.status ?? '') ? 2000 : 10000),
	});

	const { data: backups = [] } = useQuery({
		queryKey: ['backups', databaseId],
		queryFn: () => api.listBackups(databaseId),
		refetchInterval: 5000,
		enabled: !!database,
	});

	useReveal(scope, !!database);

	const status = database ? databaseStatus(database) : 'provisioning';
	const ready = status === 'ready';
	const plan = database ? DATABASE_PLANS[database.plan as DatabasePlan] : undefined;
	const address = database ? `${database.host}.service.consul:${database.port}` : '';

	return (
		<div ref={scope} className="relative min-h-screen">
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-x-0 top-0 h-[480px] overflow-hidden [mask-image:linear-gradient(to_bottom,black,transparent)]"
			>
				<div className="blueprint-grid absolute inset-0 opacity-50" />
				<div
					className={`absolute -top-40 left-1/3 h-80 w-[50%] rounded-full blur-3xl transition-colors duration-slow ${ready ? 'bg-signal-400/10' : 'bg-deck-400/10'}`}
				/>
			</div>

			<Header />

			<main className="relative mx-auto max-w-6xl px-5 pb-20 pt-10 md:px-8 md:pt-12">
				<Link
					to={paths.databases}
					className="inline-flex items-center gap-1.5 font-code text-mono uppercase tracking-[0.16em] text-steel-400 transition-colors hover:text-steel-100"
				>
					<HugeiconsIcon icon={ArrowLeft01Icon} className="h-3.5 w-3.5" />
					Databases
				</Link>

				{isError ? (
					<div className="panel mt-8 px-6 py-10">
						<p className="eyebrow text-alarm-400!">Lost contact</p>
						<p className="mt-3 text-steel-100">This database couldn't be loaded.</p>
					</div>
				) : !database ? (
					<div className="mt-8 space-y-4">
						<div className="h-16 w-2/3 animate-pulse rounded-lg bg-night-800" />
						<div className="h-32 animate-pulse rounded-xl bg-night-850" />
					</div>
				) : (
					<>
						<div className="mt-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
							<div className="min-w-0">
								<div data-reveal className="flex items-center gap-3">
									<p className="eyebrow">Database</p>
									<StatusBadge status={status} />
								</div>
								<h1 data-reveal className="display mt-4 break-words text-5xl md:text-7xl">
									{database.callsign}
								</h1>
								<div data-reveal className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1">
									<span className="flex min-w-0 items-center gap-1 font-code text-xs text-steel-500">
										<span className="truncate">{databaseId}</span>
										<CopyButton value={databaseId} label="Copy database ID" />
									</span>
									{database.restoreSourceId && (
										<Link
											to={paths.database(database.restoreSourceId)}
											className="font-code text-xs text-steel-400 transition-colors hover:text-steel-100"
										>
											restored from {database.restoreSourceId}
										</Link>
									)}
								</div>
							</div>
							<div data-reveal>
								<DatabaseActions
									databaseId={databaseId}
									callsign={database.callsign}
									status={status}
									backingUp={backups.some((b) => b.status === 'running')}
								/>
							</div>
						</div>

						<div data-reveal className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
							{ready ? (
								<div className="panel flex items-center gap-4 border-signal-400/40 bg-signal-950 px-5 py-5">
									<span className="live-dot shrink-0" aria-hidden="true" />
									<span className="min-w-0 flex-1">
										<span className="block font-code text-micro uppercase tracking-[0.2em] text-signal-400/80">
											Internal address
										</span>
										<span className="mt-1 block truncate font-code text-sm text-signal-400">{address}</span>
									</span>
									<CopyButton value={address} label="Copy internal address" />
								</div>
							) : (
								<div className="panel flex items-center gap-4 border-dashed px-5 py-5">
									<span className="h-2 w-2 shrink-0 rounded-full bg-steel-500" aria-hidden="true" />
									<span className="min-w-0">
										<span className="block font-code text-micro uppercase tracking-[0.2em] text-steel-500">
											Internal address
										</span>
										<span className="mt-1 block text-sm text-steel-400">
											{status === 'failed'
												? 'Grounded. See the reason below.'
												: status === 'deleting'
													? 'Standing down.'
													: 'Not reachable yet. Consul publishes it once the instance is healthy.'}
										</span>
									</span>
								</div>
							)}
							<dl className="panel grid grid-cols-3 gap-4 px-5 py-5">
								<Fact label="Engine">
									{ENGINES[database.engine].label} {database.version}
								</Fact>
								<Fact label="Plan">{plan ? `${plan.label} · ${database.storageGb} GB` : database.plan}</Fact>
								<Fact label="Last backup">
									{database.lastBackupAt ? formatRelativeTime(database.lastBackupAt) : '—'}
								</Fact>
							</dl>
						</div>

						{database.statusReason && (
							<div data-reveal className="panel mt-4 border-alarm-400/30 px-5 py-4">
								<p className="eyebrow text-alarm-400!">Reason</p>
								<p className="mt-2 break-words font-code text-xs text-steel-300">{database.statusReason}</p>
							</div>
						)}

						<div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
							<section data-reveal aria-labelledby="apps-title">
								<h2 id="apps-title" className="eyebrow mb-3">
									Attached apps
								</h2>
								{database.attachments.length === 0 ? (
									<div className="panel border-dashed px-5 py-5">
										<p className="text-sm text-steel-400">No apps attached.</p>
									</div>
								) : (
									<ul className="panel divide-y divide-line overflow-hidden">
										{database.attachments.map((a) => (
											<li
												key={a.id}
												className="group relative flex items-center gap-3 px-4 py-3.5 transition-colors duration-quick ease-settle hover:bg-night-850"
											>
												<div className="min-w-0 flex-1">
													<Link
														to={paths.deployment(a.deploymentId)}
														className="block truncate font-code text-sm text-steel-100 after:absolute after:inset-0"
													>
														{a.deploymentId}
													</Link>
													<p className="mt-0.5 truncate font-code text-mono text-steel-500">{a.envName}</p>
												</div>
												<span className="font-code text-mono text-steel-500">{a.status}</span>
												<HugeiconsIcon
													icon={ArrowRight01Icon}
													className="h-4 w-4 text-steel-500 transition-transform duration-quick ease-settle group-hover:translate-x-1 group-hover:text-steel-100"
												/>
											</li>
										))}
									</ul>
								)}
							</section>
							<section data-reveal aria-labelledby="backups-title">
								<h2 id="backups-title" className="eyebrow mb-3">
									Backups
								</h2>
								<BackupList databaseId={databaseId} backups={backups} canRestore={ENGINES[database.engine].available} />
							</section>
						</div>
					</>
				)}
			</main>
		</div>
	);
}
