import { Link, NavLink } from 'react-router';
import { cn } from '../lib/utils';
import { paths } from '../lib/paths';
import { Mark } from './mark';

const DOCS_URL = 'https://github.com/AdedigbaOluwad1/hangar#readme';

export function Header({ action }: { action?: React.ReactNode }) {
	return (
		<header className="sticky top-0 z-40 border-b border-line bg-night-950/85 backdrop-blur-md">
			<div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-5 md:px-8">
				<div className="flex items-center gap-8">
					<Link to="/" className="flex items-center gap-2.5" aria-label="Hangar home">
						<Mark className="h-7 w-7" />
						<span className="font-display text-xl font-bold uppercase tracking-wide text-steel-100">Hangar</span>
					</Link>
					<nav aria-label="App" className="hidden items-center gap-6 text-sm sm:flex">
						<NavLink
							to={paths.dashboard}
							className={({ isActive }) =>
								cn('transition-colors hover:text-steel-100', isActive ? 'text-steel-100' : 'text-steel-400')
							}
						>
							Deployments
						</NavLink>
						<a href={DOCS_URL} className="text-steel-400 transition-colors hover:text-steel-100">
							Docs
						</a>
					</nav>
				</div>
				{action}
			</div>
		</header>
	);
}
