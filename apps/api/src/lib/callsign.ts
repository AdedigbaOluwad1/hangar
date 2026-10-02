// Callsigns: a memorable adjective-noun handle for each deployment, so two
// deployments of the same repo can be told apart at a glance.
// The 20261002 migration copies these lists to backfill existing rows; keep
// them append-only so backfilled names stay valid entries.
export const ADJECTIVES = [
  'amber', 'ashen', 'bold', 'brass', 'bright', 'cinder', 'cobalt', 'copper',
  'crimson', 'dawn', 'dusk', 'ember', 'feral', 'frost', 'gilded', 'granite',
  'hollow', 'iron', 'ivory', 'jade', 'keen', 'lunar', 'midnight', 'night',
  'noble', 'onyx', 'quiet', 'rapid', 'rogue', 'rust', 'sable', 'scarlet',
  'shadow', 'silent', 'silver', 'slate', 'solar', 'steel', 'storm', 'swift',
  'tidal', 'umber', 'velvet', 'vivid', 'wild', 'winter', 'golden', 'polar',
] as const

export const NOUNS = [
  'albatross', 'condor', 'crane', 'falcon', 'gannet', 'goshawk', 'harrier', 'hawk',
  'heron', 'ibis', 'kestrel', 'kite', 'lark', 'magpie', 'martin', 'merlin',
  'nightjar', 'osprey', 'owl', 'peregrine', 'petrel', 'raven', 'rook', 'shrike',
  'skua', 'sparrow', 'starling', 'swallow', 'tern', 'wren', 'comet', 'corsair',
  'dart', 'glider', 'hornet', 'javelin', 'lancer', 'meteor', 'phantom', 'sabre',
  'talon', 'vector', 'viper', 'zephyr', 'nomad', 'ranger', 'drifter', 'outrider',
] as const

// lowercase words joined by single hyphens, 3–40 characters
export const CALLSIGN_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/

function pick<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)]
}

export async function generateCallsign(isTaken: (callsign: string) => Promise<boolean>): Promise<string> {
  for (let attempt = 0; attempt < 12; attempt++) {
    const callsign = `${pick(ADJECTIVES)}-${pick(NOUNS)}`
    if (!(await isTaken(callsign))) return callsign
  }
  // the 2,304 plain pairs are getting crowded; a number keeps it unique and readable
  for (;;) {
    const callsign = `${pick(ADJECTIVES)}-${pick(NOUNS)}-${Math.floor(Math.random() * 90) + 10}`
    if (!(await isTaken(callsign))) return callsign
  }
}
