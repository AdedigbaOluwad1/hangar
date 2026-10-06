import { Link } from 'react-router';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowRight01Icon, DatabaseIcon } from '@hugeicons/core-free-icons';
import { ENGINES, type DatabaseDetail } from '@hangar/types';
import { StatusBadge } from './status-badge';
import { buttonVariants } from './ui/button';
import { formatRelativeTime } from '../lib/format';
import { databaseStatus, statusOf } from '../lib/status';
import { cn } from '../lib/utils';
import { paths } from '../lib/paths';

export function DatabaseList({ databases }: { databases: DatabaseDetail[] }) {
	if (databases.length === 0) return <EmptyHold />;

	return (
		<ul className="panel divide-y divide-line overflow-hidden">
			{databases.map((d) => {
				const status = databaseStatus(d);
				const apps = d.attachments.length;
				return (
					<li
						key={d.id}
						data-reveal
						className="group relative grid grid-cols-[auto_1fr_auto] items-center gap-4 px-4 py-4 transition-colors duration-quick ease-settle hover:bg-night-850 md:grid-cols-[auto_minmax(0,1fr)_auto_auto_auto] md:px-5"
					>
						<HugeiconsIcon
							icon={DatabaseIcon}
							className={cn(
								'h-6 w-6 opacity-80 transition-transform duration-base ease-settle group-hover:translate-y-[-4px]',
								statusOf(status).glyph,
							)}
						/>
						<div className="min-w-0">
							<Link
								to={paths.database(d.id)}
								className="block truncate font-medium text-steel-100 after:absolute after:inset-0"
							>
								{d.callsign}
							</Link>
							<p className="mt-0.5 truncate font-code text-mono text-steel-500">
								{ENGINES[d.engine].label} {d.version} · {d.id}
							</p>
						</div>
						<StatusBadge status={status} />
						<span className="hidden font-code text-mono text-steel-400 md:block">
							{apps === 0 ? 'No apps' : `${apps} ${apps === 1 ? 'app' : 'apps'}`}
						</span>
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

function EmptyHold() {
	return (
		<div data-reveal className="panel relative overflow-hidden px-6 py-16 text-center md:py-20">
			<div
				aria-hidden="true"
				className="blueprint-grid absolute inset-0 opacity-50 [mask-image:radial-gradient(closest-side,black,transparent)]"
			/>
			<div className="relative">
				<HugeiconsIcon icon={DatabaseIcon} className="mx-auto h-14 w-14 text-steel-500" strokeWidth={1} />
				<p className="eyebrow mt-6">Hold empty</p>
				<h2 className="display mt-3 text-4xl md:text-5xl">No databases yet.</h2>
				<p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-steel-400">
					A dedicated Postgres on its own volume, with nightly backups and point-in-time restore.
				</p>
				<Link to={paths.newDatabase} className={buttonVariants({ className: 'mt-8' })}>
					Create your first database
					<HugeiconsIcon icon={ArrowRight01Icon} className="h-4 w-4" />
				</Link>
			</div>
		</div>
	);
}
