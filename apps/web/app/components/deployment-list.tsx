import { Link } from 'react-router';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowRight01Icon, ExternalLinkIcon } from '@hugeicons/core-free-icons';
import type { Deployment } from '@hangar/types';
import { JetPlan } from '../story/art/jet';
import { StatusBadge } from './status-badge';
import { buttonVariants } from './ui/button';
import { formatRelativeTime, repoName } from '../lib/format';
import { deploymentStatus, statusOf } from '../lib/status';
import { cn } from '../lib/utils';
import { paths } from '../lib/paths';

export function DeploymentList({ deployments }: { deployments: Deployment[] }) {
	if (deployments.length === 0) return <EmptyHangar />;

	return (
		<ul className="panel divide-y divide-line overflow-hidden">
			{deployments.map((d) => {
				const status = deploymentStatus(d);
				return (
					<li
						key={d.id}
						data-reveal
						className="group relative grid grid-cols-[auto_1fr_auto] items-center gap-4 px-4 py-4 transition-colors duration-quick ease-settle hover:bg-night-850 md:grid-cols-[auto_minmax(0,1fr)_auto_auto_auto] md:px-5"
					>
						<JetPlan
							className={cn(
								'h-7 w-5 rotate-90 opacity-80 transition-transform duration-base ease-settle group-hover:translate-y-[-4px]',
								statusOf(status).glyph,
							)}
						/>
						<div className="min-w-0">
							<Link
								to={paths.deployment(d.id)}
								className="block truncate font-medium text-steel-100 after:absolute after:inset-0"
							>
								{d.callsign}
							</Link>
							<p className="mt-0.5 truncate font-code text-mono text-steel-500">
								{repoName(d.sourceUrl) ?? 'no source'} · {d.id}
							</p>
						</div>
						<StatusBadge status={status} />
						{d.liveUrl && status === 'running' ? (
							<a
								href={d.liveUrl}
								target="_blank"
								rel="noreferrer"
								className="relative z-10 hidden items-center gap-1.5 font-code text-mono text-steel-400 transition-colors hover:text-signal-400 md:inline-flex"
							>
								Visit
								<HugeiconsIcon icon={ExternalLinkIcon} className="h-3 w-3" />
							</a>
						) : (
							<span className="hidden md:block" />
						)}
						<span className="hidden items-center gap-3 font-code text-mono text-steel-500 md:inline-flex">
							{formatRelativeTime(d.updatedAt)}
							<HugeiconsIcon
								icon={ArrowRight01Icon}
								className="h-4 w-4 text-steel-500 transition-transform duration-quick ease-settle group-hover:translate-x-1 group-hover:text-steel-100"
							/>
						</span>
					</li>
				);
			})}
		</ul>
	);
}

function EmptyHangar() {
	return (
		<div data-reveal className="panel relative overflow-hidden px-6 py-16 text-center md:py-20">
			<div
				aria-hidden="true"
				className="blueprint-grid absolute inset-0 opacity-50 [mask-image:radial-gradient(closest-side,black,transparent)]"
			/>
			<div className="relative">
				<svg viewBox="0 0 100 140" aria-hidden="true" className="mx-auto h-20 w-16 rotate-90">
					<path
						d="M50,2 L56,22 L58,60 L97,92 L97,100 L59,94 L60,120 L78,127 L78,134 L56,136 L44,136 L22,134 L22,127 L40,120 L41,94 L3,100 L3,92 L42,60 L44,22 Z"
						fill="none"
						stroke="rgb(143 170 220 / 0.6)"
						strokeDasharray="4 4"
					/>
				</svg>
				<p className="eyebrow mt-6">Bay empty</p>
				<h2 className="display mt-3 text-4xl md:text-5xl">Nothing on deck yet.</h2>
				<p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-steel-400">
					Push a Git URL. Hangar builds it, schedules it on Nomad and routes it through Caddy.
				</p>
				<Link to={paths.newDeployment} className={buttonVariants({ className: 'mt-8' })}>
					Deploy your first app
					<HugeiconsIcon icon={ArrowRight01Icon} className="h-4 w-4" />
				</Link>
			</div>
		</div>
	);
}
