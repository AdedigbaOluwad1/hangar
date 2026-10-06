import { Link, NavLink, useLocation, useNavigate } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { cn } from '../lib/utils';
import { paths } from '../lib/paths';
import { Mark } from './mark';

const DOCS_URL = 'https://github.com/AdedigbaOluwad1/hangar#readme';

function SignOut() {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const mutation = useMutation({
		mutationFn: api.signOut,
		onSettled: () => {
			queryClient.clear();
			navigate(paths.signIn, { replace: true });
		},
	});

	return (
		<button
			type="button"
			onClick={() => mutation.mutate()}
			disabled={mutation.isPending}
			className="text-steel-400 transition-colors hover:text-steel-100 disabled:opacity-50"
		>
			Sign out
		</button>
	);
}

export function Header({ action, bare }: { action?: React.ReactNode; bare?: boolean }) {
	const { pathname } = useLocation();
	const onDatabases = pathname.startsWith(paths.databases);
	return (
		<header className="sticky top-0 z-40 border-b border-line bg-night-950/85 backdrop-blur-md">
			<div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-5 md:px-8">
				<div className="flex items-center gap-8">
					<Link to="/" className="flex items-center gap-2.5" aria-label="Hangar home">
						<Mark className="h-7 w-7" />
						<span className="font-display text-xl font-bold uppercase tracking-wide text-steel-100">Hangar</span>
					</Link>
					{!bare && (
						<nav aria-label="App" className="hidden items-center gap-6 text-sm sm:flex">
							<NavLink
								to={paths.dashboard}
								className={({ isActive }) =>
									cn(
										'transition-colors hover:text-steel-100',
										isActive && !onDatabases ? 'text-steel-100' : 'text-steel-400',
									)
								}
							>
								Deployments
							</NavLink>
							<NavLink
								to={paths.databases}
								className={({ isActive }) =>
									cn('transition-colors hover:text-steel-100', isActive ? 'text-steel-100' : 'text-steel-400')
								}
							>
								Databases
							</NavLink>
							<a href={DOCS_URL} className="text-steel-400 transition-colors hover:text-steel-100">
								Docs
							</a>
							<SignOut />
						</nav>
					)}
				</div>
				{action}
			</div>
		</header>
	);
}
