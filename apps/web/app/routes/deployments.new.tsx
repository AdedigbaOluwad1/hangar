// apps/web/app/routes/deployments.new.tsx
import { useRef } from 'react';
import { Link } from 'react-router';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft01Icon } from '@hugeicons/core-free-icons';
import type { Route } from './+types/deployments.new';
import { useReveal } from '../lib/motion';
import { Header } from '../components/header';
import { DeployForm } from '../components/deploy-form';
import { FLIGHT_PLAN } from '../components/flight-path';

export function meta({}: Route.MetaArgs) {
	return [{ title: 'New deployment · Hangar' }];
}

export default function NewDeployment() {
	const scope = useRef<HTMLDivElement>(null);
	useReveal(scope, true);

	return (
		<div ref={scope} className="relative min-h-screen">
			<div
				aria-hidden="true"
				className="blueprint-grid pointer-events-none absolute inset-0 opacity-40 [mask-image:linear-gradient(to_bottom,black,transparent_70%)]"
			/>
			<Header />
			<main className="relative mx-auto grid max-w-6xl gap-10 px-5 pb-20 pt-10 md:grid-cols-[minmax(0,340px)_1fr] md:gap-16 md:px-8 md:pt-14">
				<div className="md:sticky md:top-28 md:self-start">
					<Link
						to="/dashboard"
						data-reveal
						className="inline-flex items-center gap-1.5 font-code text-[11px] uppercase tracking-[0.16em] text-steel-400 transition-colors hover:text-steel-100"
					>
						<HugeiconsIcon icon={ArrowLeft01Icon} className="h-3.5 w-3.5" />
						Deployments
					</Link>
					<p data-reveal className="eyebrow mt-8">
						Pre-flight
					</p>
					<h1 data-reveal className="display mt-4 text-5xl md:text-7xl">
						New deployment
					</h1>
					<p data-reveal className="mt-5 max-w-sm text-sm leading-relaxed text-steel-400">
						Point Hangar at a repository. From there it's one flight plan, with no Dockerfile required.
					</p>
					<ol data-reveal className="mt-8 space-y-2.5 border-l border-line pl-4">
						{FLIGHT_PLAN.map((s, i) => (
							<li key={s.key} className="flex items-baseline gap-3 text-sm">
								<span className="font-code text-[10px] text-deck-400">{String(i + 1).padStart(2, '0')}</span>
								<span className="text-steel-100">{s.label}</span>
								<span className="truncate text-xs text-steel-500">{s.by}</span>
							</li>
						))}
					</ol>
				</div>
				<DeployForm />
			</main>
		</div>
	);
}
