import type { SVGProps } from 'react';
import { ART } from './palette';

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
		body: ART.hull,
		shade: ART.night,
		glass: ART.panel,
		line: 'transparent',
	},
	steel: {
		body: ART.jet,
		shade: ART.jetShade,
		glass: ART.canopy,
		line: 'rgb(183 205 240 / 0.35)',
	},
};

export function JetSide({
	tone = 'steel',
	flame = false,
	gear = true,
	...props
}: SVGProps<SVGSVGElement> & { tone?: Tone; flame?: boolean; gear?: boolean }) {
	const t = TONES[tone];
	return (
		<svg viewBox="0 0 400 120" overflow="visible" aria-hidden="true" {...props}>
			{flame && (
				<>
					<defs>
						<filter id="jet-flame-soft" x="-20%" y="-60%" width="140%" height="220%">
							<feGaussianBlur stdDeviation="2.2" />
						</filter>
						<radialGradient id="jet-flame-bloom" cx="1" cy="0.5" r="1">
							<stop offset="0" stopColor={ART.amber} stopOpacity="0.55" />
							<stop offset="1" stopColor={ART.amberDeep} stopOpacity="0" />
						</radialGradient>
						<linearGradient id="jet-flame-outer" x1="1" x2="0" y1="0" y2="0">
							<stop offset="0" stopColor={ART.amberDeep} stopOpacity="0.95" />
							<stop offset="0.45" stopColor={ART.amberDeep} stopOpacity="0.55" />
							<stop offset="1" stopColor={ART.amberDeep} stopOpacity="0" />
						</linearGradient>
						<linearGradient id="jet-flame-inner" x1="1" x2="0" y1="0" y2="0">
							<stop offset="0" stopColor={ART.amberSoft} />
							<stop offset="0.5" stopColor={ART.amber} stopOpacity="0.85" />
							<stop offset="1" stopColor={ART.amber} stopOpacity="0" />
						</linearGradient>
						<linearGradient id="jet-flame-core" x1="1" x2="0" y1="0" y2="0">
							<stop offset="0" stopColor={ART.flameCore} />
							<stop offset="1" stopColor={ART.amberSoft} stopOpacity="0" />
						</linearGradient>
					</defs>
					<g data-part="flame">
						<ellipse
							data-flame-layer
							cx="-30"
							cy="74"
							rx="78"
							ry="17"
							fill="url(#jet-flame-bloom)"
							filter="url(#jet-flame-soft)"
						/>
						<path
							data-flame-layer
							d="M5,65.5 C-22,66 -64,70.5 -132,74 C-64,77.5 -22,82 5,82.5 Z"
							fill="url(#jet-flame-outer)"
							filter="url(#jet-flame-soft)"
						/>
						<path
							data-flame-layer
							d="M5,68.5 C-16,69 -48,72 -88,74 C-48,76 -16,79 5,79.5 Z"
							fill="url(#jet-flame-inner)"
						/>
						<path
							data-flame-layer
							d="M5,71.2 C-6,71.4 -20,73 -40,74 C-20,75 -6,76.6 5,76.8 Z"
							fill="url(#jet-flame-core)"
						/>
						<g data-flame-diamonds fill={ART.flameCore}>
							<path d="M-18,74 L-23,72.2 L-28,74 L-23,75.8 Z" opacity="0.85" />
							<path d="M-40,74 L-44.5,72.6 L-49,74 L-44.5,75.4 Z" opacity="0.6" />
							<path d="M-60,74 L-64,72.9 L-68,74 L-64,75.1 Z" opacity="0.38" />
						</g>
					</g>
				</>
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

export function JetPlan({ color = 'currentColor', ...props }: SVGProps<SVGSVGElement> & { color?: string }) {
	return (
		<svg viewBox="0 0 100 140" aria-hidden="true" {...props}>
			<path d="M57,52 L97,92 L97,100 L59,94 Z M43,52 L3,92 L3,100 L41,94 Z" fill={color} opacity="0.85" />
			<path d="M58,112 L78,127 L78,134 L58,129 Z M42,112 L22,127 L22,134 L42,129 Z" fill={color} opacity="0.85" />
			<path d="M50,2 L56,22 L58,60 L60,120 L56,136 L44,136 L40,120 L42,60 L44,22 Z" fill={color} />
			<ellipse cx="50" cy="32" rx="3.6" ry="10" fill={ART.canopy} opacity="0.8" />
		</svg>
	);
}
