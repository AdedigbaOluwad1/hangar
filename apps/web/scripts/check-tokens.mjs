import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('../app/', import.meta.url).pathname;
const strict = process.argv.includes('--strict');

const SKIP = new Set(['lib/motion.ts', 'story/art/palette.ts']);

const RULES = [
	{ id: 'hex-color', re: /#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3}(?:[0-9a-fA-F]{2})?)?\b/g, hint: 'use a colour token' },
	{ id: 'arbitrary-color', re: /\b(?:bg|text|border|from|via|to|fill|stroke|ring)-\[#[^\]]+\]/g, hint: 'use a colour token' },
	{ id: 'palette-escape', re: /\b(?:bg|text|border)-(?:white|black)\b/g, hint: 'use steel/night tokens' },
	{ id: 'raw-ease', re: /ease:\s*['"][^'"]+['"]|\bease-(?:linear|in|out|in-out)\b/g, hint: 'use EASE.* / ease-settle etc.' },
	{ id: 'raw-duration-class', re: /\bduration-\d+\b/g, hint: 'use duration-instant…duration-epic' },
	{ id: 'raw-text-size', re: /\btext-\[(?:\d|clamp)[^\]]*\]/g, hint: 'use a text-* size token' },
	{ id: 'raw-radius', re: /\brounded-\[[^\]]+\]/g, hint: 'use rounded-lg / rounded-xl etc.' },
	{ id: 'arbitrary-duration', re: /\bduration-\[[^\]]+\]/g, hint: 'use a duration step' },
	{ id: 'raw-timeout', re: /setTimeout\(.*,\s*\d{3,}\s*\)/g, hint: 'name the delay or use DUR' },
	{ id: 'raw-seconds', re: /\b(?:duration|delay):\s*\d*\.?\d+\b/g, hint: 'use DUR.*', outsideStoryOnly: true },
];

function walk(dir) {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) return walk(path);
		return /\.(tsx?|mjs)$/.test(name) ? [path] : [];
	});
}

const findings = [];
for (const file of walk(ROOT)) {
	const rel = relative(ROOT, file);
	if (SKIP.has(rel)) continue;
	readFileSync(file, 'utf8')
		.split('\n')
		.forEach((line, i) => {
			if (line.includes('tokens-ok:')) return;
			for (const rule of RULES) {
				if (rule.outsideStoryOnly && rel.startsWith('story/')) continue;
				for (const match of line.matchAll(rule.re)) {
					findings.push({ rel, line: i + 1, rule: rule.id, text: match[0], hint: rule.hint });
				}
			}
		});
}

const byRule = Object.groupBy(findings, (f) => f.rule);
for (const [rule, list] of Object.entries(byRule)) {
	console.log(`\n${rule} (${list.length}) — ${list[0].hint}`);
	for (const f of list) console.log(`  ${f.rel}:${f.line}  ${f.text}`);
}
console.log(`\n${findings.length} token finding${findings.length === 1 ? '' : 's'}${strict ? '' : ' (report only; pass --strict to fail)'}`);
if (strict && findings.length) process.exit(1);
