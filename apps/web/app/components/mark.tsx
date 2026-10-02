import { useId } from 'react';
import { DECK_LINE, DELTA, DOOR_BAND, MARK_VIEWBOX, SHIELD } from '../lib/brand';

export function Shield({ rim = 1.8 }: { rim?: number }) {
	const clip = useId();
	return (
		<>
			<defs>
				<clipPath id={clip}>
					<path d={SHIELD} />
				</clipPath>
			</defs>
			<path d={SHIELD} className="fill-night-950" />
			<rect {...DOOR_BAND} clipPath={`url(#${clip})`} className="fill-deck-400" />
			<path d={DELTA} className="fill-deck-400" />
			<path d={DECK_LINE} strokeWidth="1.5" strokeLinecap="round" className="stroke-deck-400" />
			<path d={SHIELD} fill="none" strokeWidth={rim} strokeLinejoin="round" className="stroke-deck-400" />
		</>
	);
}

export function Mark({ className }: { className?: string }) {
	return (
		<svg viewBox={MARK_VIEWBOX} aria-hidden="true" className={className}>
			<Shield />
		</svg>
	);
}
