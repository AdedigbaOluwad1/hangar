// apps/web/app/story/nav.tsx
import type { MouseEvent } from 'react';
import { Link } from 'react-router';
import { jumpToAct } from './motion';
import { Mark } from '../components/mark';
import { buttonVariants } from '../components/ui/button';
import { paths } from '../lib/paths';

export const GITHUB_URL = 'https://github.com/AdedigbaOluwad1/hangar';
export const DOCS_URL = `${GITHUB_URL}#readme`;

const LINKS = [
	{ href: '#hangar', label: 'Pipeline' },
	{ href: '#crew', label: 'Stack' },
	{ href: '#squadron', label: 'Operations' },
	{ href: '#fleet', label: 'Roadmap' },
];

function onAnchor(e: MouseEvent<HTMLAnchorElement>) {
	const id = e.currentTarget.hash.slice(1);
	e.preventDefault();
	history.replaceState(null, '', `#${id}`);
	jumpToAct(id);
}

export function StoryNav() {
	return (
		<header className="absolute inset-x-0 top-0 z-40">
			<nav
				aria-label="Primary"
				className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-5 md:h-20 md:px-10"
			>
				<Link to="/" className="flex items-center gap-2.5" aria-label="Hangar home">
					<Mark className="h-7 w-7" />
					<span className="font-display text-xl font-bold uppercase tracking-wide text-steel-100">Hangar</span>
				</Link>
				<ul className="hidden items-center gap-8 text-sm text-steel-300 md:flex">
					{LINKS.map((l) => (
						<li key={l.href}>
							<a href={l.href} onClick={onAnchor} className="transition-colors hover:text-steel-100">
								{l.label}
							</a>
						</li>
					))}
					<li>
						<a href={GITHUB_URL} className="transition-colors hover:text-steel-100">
							GitHub
						</a>
					</li>
				</ul>
				<Link to={paths.dashboard} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
					Dashboard
				</Link>
			</nav>
		</header>
	);
}
