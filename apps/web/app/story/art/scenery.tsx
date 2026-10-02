// apps/web/app/story/art/scenery.tsx
import type { SVGProps } from 'react';

// Deterministic star field so server and client render the same markup.
function stars(count: number, seed: number) {
	let s = seed;
	const rand = () => {
		s = (s * 16807) % 2147483647;
		return s / 2147483647;
	};
	return Array.from({ length: count }, () => ({
		x: rand() * 1600,
		y: rand() * 520,
		r: rand() * 1.1 + 0.3,
		o: rand() * 0.6 + 0.15,
	}));
}

const STARS = stars(90, 7);

export function StarField(props: SVGProps<SVGSVGElement>) {
	return (
		<svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true" {...props}>
			{STARS.map((st, i) => (
				<circle key={i} cx={st.x} cy={st.y} r={st.r} fill="#cfe0ff" opacity={st.o} />
			))}
		</svg>
	);
}

// Distant escorts on the horizon line: just enough to read as a carrier group.
export function Horizon(props: SVGProps<SVGSVGElement>) {
	return (
		<svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" aria-hidden="true" {...props}>
			<rect x="0" y="640" width="1600" height="260" fill="#04070d" />
			<line x1="0" y1="640" x2="1600" y2="640" stroke="rgb(255 178 74 / 0.35)" strokeWidth="1" />
			<path d="M180,640 L188,628 L214,628 L218,620 L226,620 L230,628 L262,628 L268,640 Z" fill="#070b14" />
			<path d="M420,640 L426,632 L446,632 L449,626 L455,626 L458,632 L478,632 L482,640 Z" fill="#070b14" />
			<path d="M1380,640 L1386,630 L1412,630 L1416,622 L1424,622 L1428,630 L1458,630 L1464,640 Z" fill="#070b14" />
		</svg>
	);
}

// Flight deck crew, side view. Jersey colour follows real carrier practice:
// the colour tells you the job at a glance.
export function CrewFigure({ jersey, ...props }: SVGProps<SVGGElement> & { jersey: string }) {
	return (
		<g {...props}>
			<rect x="-6" y="-32" width="12" height="20" rx="4" fill={jersey} />
			<circle cx="0" cy="-38" r="5" fill={jersey} />
			<rect x="-5" y="-14" width="4" height="14" rx="2" fill="#0b1220" />
			<rect x="1" y="-14" width="4" height="14" rx="2" fill="#0b1220" />
			<g data-arm>
				<rect x="4.5" y="-30" width="3.4" height="16" rx="1.7" fill={jersey} />
			</g>
		</g>
	);
}

// Thin technical-drawing annotation: a dimension line with end ticks and a label.
export function Dimension({
	x1,
	x2,
	y,
	label,
	size = 11,
}: {
	x1: number;
	x2: number;
	y: number;
	label: string;
	size?: number;
}) {
	return (
		<g stroke="rgb(143 170 220 / 0.45)" strokeWidth="1" fill="none">
			<line x1={x1} y1={y} x2={x2} y2={y} />
			<line x1={x1} y1={y - size / 2} x2={x1} y2={y + size / 2} />
			<line x1={x2} y1={y - size / 2} x2={x2} y2={y + size / 2} />
			<text
				x={(x1 + x2) / 2}
				y={y - size * 0.7}
				fill="rgb(143 170 220 / 0.7)"
				stroke="none"
				fontSize={size}
				textAnchor="middle"
				fontFamily="var(--font-code)"
				letterSpacing={size * 0.14}
			>
				{label}
			</text>
		</g>
	);
}
