import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import {
	DECK_LINE,
	DELTA,
	DOOR_BAND,
	EMBLEM_SHIELD_TRANSFORM,
	EMBLEM_VIEWBOX,
	MARK_VIEWBOX,
	SHIELD,
	WINGS,
} from '../app/lib/brand.ts';

const root = new URL('../', import.meta.url).pathname;
const pub = `${root}public/`;
const css = readFileSync(`${root}app/app.css`, 'utf8');
const token = (name) => css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-f]{6})`))[1];
const C = {
	night: token('night-950'),
	panel: token('night-900'),
	amber: token('deck-400'),
	text: token('steel-100'),
	muted: token('steel-400'),
	line: 'rgb(143 170 220 / 0.16)',
};

const font = (pkg, file) =>
	readFileSync(`${root}node_modules/@fontsource-variable/${pkg}/files/${file}`).toString('base64');
const fonts = `@font-face{font-family:Display;src:url(data:font/woff2;base64,${font('big-shoulders-display', 'big-shoulders-display-latin-wght-normal.woff2')})}
@font-face{font-family:Text;src:url(data:font/woff2;base64,${font('inter', 'inter-latin-wght-normal.woff2')})}
@font-face{font-family:Code;src:url(data:font/woff2;base64,${font('jetbrains-mono', 'jetbrains-mono-latin-wght-normal.woff2')})}`;

const shield = (rim, id) => `<defs><clipPath id="${id}"><path d="${SHIELD}"/></clipPath></defs>
<path d="${SHIELD}" fill="${C.night}"/>
<rect x="${DOOR_BAND.x}" y="${DOOR_BAND.y}" width="${DOOR_BAND.width}" height="${DOOR_BAND.height}" fill="${C.amber}" clip-path="url(#${id})"/>
<path d="${DELTA}" fill="${C.amber}"/>
<path d="${DECK_LINE}" stroke="${C.amber}" stroke-width="1.5" stroke-linecap="round"/>
<path d="${SHIELD}" fill="none" stroke="${C.amber}" stroke-width="${rim}" stroke-linejoin="round"/>`;

const svg = (viewBox, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${body}</svg>`;

const markSvg = svg(MARK_VIEWBOX, shield(1.8, 's'));
const tileSvg = svg(MARK_VIEWBOX, `<rect width="32" height="32" rx="7" fill="${C.panel}"/>${shield(1.8, 's')}`);
const squareSvg = (inset) =>
	svg(
		MARK_VIEWBOX,
		`<rect width="32" height="32" fill="${C.panel}"/><g transform="translate(${inset} ${inset}) scale(${(32 - inset * 2) / 32})">${shield(1.8, 's')}</g>`,
	);
const emblemSvg = svg(
	EMBLEM_VIEWBOX,
	`${WINGS.map((d) => `<path d="${d}" fill="${C.amber}"/>`).join('')}<g transform="${EMBLEM_SHIELD_TRANSFORM}">${shield(2.4, 'e')}</g>`,
);

const dataUri = (s) => `data:image/svg+xml;base64,${Buffer.from(s).toString('base64')}`;

const og = `<!doctype html><style>${fonts}
html,body{margin:0;width:1200px;height:630px;background:${C.night};overflow:hidden}
.grid{position:absolute;inset:0;background-image:linear-gradient(${C.line} 1px,transparent 1px),linear-gradient(90deg,${C.line} 1px,transparent 1px);background-size:60px 60px;-webkit-mask-image:radial-gradient(closest-side,#000,transparent)}
.glow{position:absolute;left:50%;top:38%;width:760px;height:300px;transform:translate(-50%,-50%);border-radius:50%;background:${C.amber};opacity:.12;filter:blur(90px)}
.stack{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:26px}
img{width:420px}
h1{margin:0;font:800 132px/0.88 Display;letter-spacing:.06em;color:${C.text};text-transform:uppercase}
p{margin:0;font:500 30px Text;color:${C.muted}}
small{font:500 18px Code;letter-spacing:.22em;color:${C.amber};text-transform:uppercase}</style>
<div class="grid"></div><div class="glow"></div>
<div class="stack"><img src="${dataUri(emblemSvg)}"><h1>Hangar</h1><p>Your apps deserve a runway.</p><small>Self-hosted · HashiCorp stack</small></div>`;

function ico(pngs) {
	const header = Buffer.alloc(6);
	header.writeUInt16LE(0, 0);
	header.writeUInt16LE(1, 2);
	header.writeUInt16LE(pngs.length, 4);
	let offset = 6 + pngs.length * 16;
	const entries = pngs.map(({ size, data }) => {
		const e = Buffer.alloc(16);
		e.writeUInt8(size >= 256 ? 0 : size, 0);
		e.writeUInt8(size >= 256 ? 0 : size, 1);
		e.writeUInt16LE(1, 4);
		e.writeUInt16LE(32, 6);
		e.writeUInt32LE(data.length, 8);
		e.writeUInt32LE(offset, 12);
		offset += data.length;
		return e;
	});
	return Buffer.concat([header, ...entries, ...pngs.map((p) => p.data)]);
}

const browser = await chromium.launch();
const page = await browser.newPage();
async function png(svgString, size) {
	await page.setViewportSize({ width: size, height: size });
	await page.setContent(
		`<style>html,body{margin:0;background:transparent}img{display:block;width:${size}px;height:${size}px}</style><img src="${dataUri(svgString)}">`,
	);
	return page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
}

mkdirSync(`${pub}brand`, { recursive: true });
writeFileSync(`${pub}favicon.svg`, tileSvg);
writeFileSync(`${pub}brand/mark.svg`, markSvg);
writeFileSync(`${pub}brand/emblem.svg`, emblemSvg);
writeFileSync(
	`${pub}favicon.ico`,
	ico(await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await png(tileSvg, size) })))),
);
writeFileSync(`${pub}apple-touch-icon.png`, await png(squareSvg(3), 180));
writeFileSync(`${pub}brand/icon-192.png`, await png(tileSvg, 192));
writeFileSync(`${pub}brand/icon-512.png`, await png(tileSvg, 512));
writeFileSync(`${pub}brand/icon-maskable-512.png`, await png(squareSvg(6.4), 512));

await page.setViewportSize({ width: 1200, height: 630 });
await page.setContent(og);
await page.evaluate(() => document.fonts.ready);
writeFileSync(`${pub}brand/og.png`, await page.screenshot({ type: 'png' }));
await browser.close();

writeFileSync(
	`${pub}site.webmanifest`,
	`${JSON.stringify(
		{
			name: 'Hangar',
			short_name: 'Hangar',
			description: 'The self-hosted platform that launches everything on your homelab.',
			start_url: '/dashboard',
			display: 'standalone',
			background_color: C.night,
			theme_color: C.night,
			icons: [
				{ src: '/brand/icon-192.png', sizes: '192x192', type: 'image/png' },
				{ src: '/brand/icon-512.png', sizes: '512x512', type: 'image/png' },
				{ src: '/brand/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
			],
		},
		null,
		'\t',
	)}\n`,
);

console.log('brand assets written to public/');
