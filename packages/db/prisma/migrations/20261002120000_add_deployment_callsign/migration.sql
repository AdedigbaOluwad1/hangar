-- AlterTable
ALTER TABLE "deployments" ADD COLUMN "callsign" TEXT;

-- Backfill existing deployments in creation order. Row k takes ADJECTIVES[k % 48]
-- and NOUNS[(29k + k / 48) % 48]: rows sharing an adjective are 48m apart and
-- their nouns differ by m (mod 48), so the first 2,304 rows get distinct pairs
-- while neighbours still get varied nouns. Rows past that get k appended.
WITH numbered AS (
  SELECT "id", (ROW_NUMBER() OVER (ORDER BY "created_at", "id") - 1) AS k
  FROM "deployments"
),
words AS (
  SELECT
    ARRAY['amber', 'ashen', 'bold', 'brass', 'bright', 'cinder', 'cobalt', 'copper', 'crimson', 'dawn', 'dusk', 'ember', 'feral', 'frost', 'gilded', 'granite', 'hollow', 'iron', 'ivory', 'jade', 'keen', 'lunar', 'midnight', 'night', 'noble', 'onyx', 'quiet', 'rapid', 'rogue', 'rust', 'sable', 'scarlet', 'shadow', 'silent', 'silver', 'slate', 'solar', 'steel', 'storm', 'swift', 'tidal', 'umber', 'velvet', 'vivid', 'wild', 'winter', 'golden', 'polar'] AS adjectives,
    ARRAY['albatross', 'condor', 'crane', 'falcon', 'gannet', 'goshawk', 'harrier', 'hawk', 'heron', 'ibis', 'kestrel', 'kite', 'lark', 'magpie', 'martin', 'merlin', 'nightjar', 'osprey', 'owl', 'peregrine', 'petrel', 'raven', 'rook', 'shrike', 'skua', 'sparrow', 'starling', 'swallow', 'tern', 'wren', 'comet', 'corsair', 'dart', 'glider', 'hornet', 'javelin', 'lancer', 'meteor', 'phantom', 'sabre', 'talon', 'vector', 'viper', 'zephyr', 'nomad', 'ranger', 'drifter', 'outrider'] AS nouns
)
UPDATE "deployments" d
SET "callsign" = w.adjectives[(n.k % 48)::int + 1] || '-' || w.nouns[((n.k * 29 + n.k / 48) % 48)::int + 1]
  || CASE WHEN n.k >= 2304 THEN '-' || n.k::text ELSE '' END
FROM numbered n, words w
WHERE d."id" = n."id";

ALTER TABLE "deployments" ALTER COLUMN "callsign" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "deployments_callsign_key" ON "deployments"("callsign");
