// apps/web/app/story/art/jet.tsx
import type { SVGProps } from 'react';

// Shared outline so the blueprint stroke, the silhouette and the assembled jet
// always line up exactly.
export const FUSELAGE =
	'M18,74 L30,66 L80,61 L230,58 C270,56 300,55 330,60 L370,66 C384,68 394,70 398,71 C394,73 384,74 370,76 L330,80 L230,84 L80,86 L30,84 L18,80 Z';
export const CANOPY = 'M262,58 C276,40 306,40 326,58 Z';
export const FIN = 'M44,64 L70,14 L96,14 L112,60 Z';
export const STAB = 'M14,78 L76,76 L64,96 L26,94 Z';
export const WING = 'M120,78 L224,74 L262,82 L132,90 Z';
const INTAKE = 'M222,76 L262,74 L266,86 L228,88 Z';
const NOZZLE = 'M4,68 L18,66 L18,82 L4,80 Z';

type Tone = 'silhouette' | 'steel';

const TONES: Record<Tone, { body: string; shade: string; glass: string; line: string }> = {
	silhouette: {
		body: '#05080f',
		shade: '#03050a',
		glass: '#0b1220',
		line: 'transparent',
	},
	steel: {
		body: '#2a3a57',
		shade: '#1b2740',
		glass: '#7fa6d9',
		line: 'rgb(183 205 240 / 0.35)',
	},
};

// Side profile, nose to the right. Each part is its own group (data-part) so
// the hangar act can assemble it piece by piece.
export function JetSide({
	tone = 'steel',
	flame = false,
	gear = true,
	...props
}: SVGProps<SVGSVGElement> & { tone?: Tone; flame?: boolean; gear?: boolean }) {
	const t = TONES[tone];
	return (
		<svg viewBox="0 0 400 120" overflow="visible" aria-hidden="true" {...props}>
			<defs>
				<linearGradient id="jet-flame" x1="1" x2="0" y1="0" y2="0">
					<stop offset="0" stopColor="#fff4dc" />
					<stop offset="0.25" stopColor="#ffb24a" />
					<stop offset="1" stopColor="#f39a1f" stopOpacity="0" />
				</linearGradient>
			</defs>
			{flame && (
				<path
					data-part="flame"
					d="M5,68 C-30,69 -70,72 -120,74 C-70,76 -30,79 5,80 Z"
					fill="url(#jet-flame)"
					style={{ transformOrigin: '5px 74px' }}
				/>
			)}
			{gear && (
				<g data-part="gear" stroke={t.shade} strokeWidth="4" fill={t.shade}>
					<line x1="302" y1="80" x2="302" y2="104" />
					<circle cx="302" cy="108" r="6" stroke="none" />
					<line x1="150" y1="86" x2="150" y2="104" />
					<circle cx="150" cy="108" r="8" stroke="none" />
				</g>
			)}
			<path data-part="stab" d={STAB} fill={t.shade} />
			<path data-part="fin" d={FIN} fill={t.body} />
			<path data-part="fuselage" d={FUSELAGE} fill={t.body} />
			<path data-part="canopy" d={CANOPY} fill={t.glass} opacity={tone === 'steel' ? 0.85 : 1} />
			<path data-part="wing" d={WING} fill={t.shade} />
			<path data-part="intake" d={INTAKE} fill={t.shade} />
			<path data-part="nozzle" d={NOZZLE} fill={t.shade} />
			<g data-part="panels" fill="none" stroke={t.line} strokeWidth="1">
				<path d="M80,70 L330,66" />
				<path d="M196,59 L196,84 M120,61 L120,86" />
				<path d="M140,80 L250,78" strokeDasharray="3 4" />
			</g>
		</svg>
	);
}

// Top-down view, nose up. Used for the squadron and the deck plan.
export function JetPlan({ color = '#2a3a57', ...props }: SVGProps<SVGSVGElement> & { color?: string }) {
	return (
		<svg viewBox="0 0 100 140" aria-hidden="true" {...props}>
			<path d="M57,52 L97,92 L97,100 L59,94 Z M43,52 L3,92 L3,100 L41,94 Z" fill={color} opacity="0.85" />
			<path d="M58,112 L78,127 L78,134 L58,129 Z M42,112 L22,127 L22,134 L42,129 Z" fill={color} opacity="0.85" />
			<path d="M50,2 L56,22 L58,60 L60,120 L56,136 L44,136 L40,120 L42,60 L44,22 Z" fill={color} />
			<ellipse cx="50" cy="32" rx="3.6" ry="10" fill="#7fa6d9" opacity="0.8" />
		</svg>
	);
}
