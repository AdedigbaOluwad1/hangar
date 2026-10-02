import { EMBLEM_SHIELD_TRANSFORM, EMBLEM_VIEWBOX, WINGS } from '../lib/brand';
import { Shield } from './mark';

export function Emblem({ className }: { className?: string }) {
	return (
		<svg viewBox={EMBLEM_VIEWBOX} aria-hidden="true" className={className}>
			{WINGS.map((d) => (
				<path key={d} d={d} className="fill-deck-400" />
			))}
			<g transform={EMBLEM_SHIELD_TRANSFORM}>
				<Shield rim={2.4} />
			</g>
		</svg>
	);
}
