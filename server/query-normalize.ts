/**
 * Search Query Normalization
 * ──────────────────────────
 * Cleans and normalizes raw search queries so typos, case variants,
 * and synonyms cluster together. Works in three passes:
 *
 * 1. Rules — lowercase, strip punctuation, collapse whitespace, remove
 *    stop words, apply Ghana-specific synonyms (benz → mercedes).
 * 2. Catalog matching — if a token fuzzy-matches a known make/model/part
 *    word from the product catalog, replace it with the canonical form.
 * 3. Clustering — group variants by normalized form. "bmper" and "bumper"
 *    collapse to the same bucket.
 *
 * Built with zero dependencies. Uses Levenshtein distance for fuzzy
 * matching, cached per server boot.
 */

// ─── Stop words — filtered out entirely ───────────────────────────
const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this',
  'car', 'parts', 'part', 'spare', 'auto', 'new', 'used',
  'please', 'need', 'want', 'looking', 'buy', 'buying',
  'ghana', 'accra', 'kumasi',
  'a', 'an', 'of', 'to', 'in', 'on', 'at', 'is', 'are',
]);

// ─── Ghana-specific synonyms and common misspellings ─────────────
// Canonical form on the right. Add more as you see them in the data.
const SYNONYMS: Record<string, string> = {
  // Makes
  'benz': 'mercedes',
  'merc': 'mercedes',
  'mercedez': 'mercedes',
  'mercedez-benz': 'mercedes',
  'mercedes-benz': 'mercedes',
  'toyta': 'toyota',
  'toyot': 'toyota',
  'toyoya': 'toyota',
  'toytoa': 'toyota',
  'mitsubitshi': 'mitsubishi',
  'mitsubushi': 'mitsubishi',
  'mitsibushi': 'mitsubishi',
  'nisan': 'nissan',
  'nissian': 'nissan',
  'huyndai': 'hyundai',
  'hundai': 'hyundai',
  'hynudai': 'hyundai',
  'kiaa': 'kia',
  'chevy': 'chevrolet',
  'vw': 'volkswagen',
  'bmer': 'bmw',
  'bimmer': 'bmw',
  'landcruiser': 'land cruiser',
  'landrover': 'land rover',

  // Parts — map common variants to canonical
  'bmper': 'bumper',
  'bumpr': 'bumper',
  'bumber': 'bumper',
  'headlite': 'headlight',
  'headlights': 'headlight',
  'headlamp': 'headlight',
  'head-light': 'headlight',
  'tailight': 'taillight',
  'taillights': 'taillight',
  'rearlight': 'taillight',
  'rear-light': 'taillight',
  'brakepad': 'brake pad',
  'brakepads': 'brake pad',
  'brake-pad': 'brake pad',
  'brake-pads': 'brake pad',
  'filters': 'filter',
  'tyre': 'tire',
  'tyres': 'tire',
  'tires': 'tire',
  'altenator': 'alternator',
  'alternater': 'alternator',
  'stering': 'steering',
  'sterring': 'steering',
  'mufler': 'muffler',
  'raditor': 'radiator',
  'radiater': 'radiator',
  'batery': 'battery',
  'clutches': 'clutch',
  'shocks': 'shock absorber',
  'shock': 'shock absorber',
  'absorber': 'shock absorber',
  'windshield': 'windscreen',
  'winshield': 'windscreen',
  'winscreen': 'windscreen',
  'bonet': 'bonnet',
  'hood': 'bonnet',
  'trunk': 'boot',

  // Models
  'landcruizer': 'land cruiser',
  'rav-4': 'rav4',
  'crv': 'cr-v',
  'civc': 'civic',
  'corola': 'corolla',
  'corrola': 'corolla',
  'coralla': 'corolla',
  'vits': 'vitz',
  'vtz': 'vitz',
  'lancar': 'lancer',
  'lancer': 'lancer',
};

/**
 * Calculate Levenshtein distance between two strings.
 * Used for fuzzy matching short words (typos).
 */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1,     // deletion
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

/**
 * Fuzzy match a word against a vocabulary. Returns the closest match
 * within a distance threshold, or null if nothing is close enough.
 * Threshold scales with word length: 1 typo for ≤5 chars, 2 for ≤10, 3 for longer.
 */
function fuzzyMatch(word: string, vocabulary: string[]): string | null {
  if (vocabulary.length === 0) return null;
  const maxDistance = word.length <= 5 ? 1 : word.length <= 10 ? 2 : 3;
  let best: string | null = null;
  let bestDist = maxDistance + 1;
  for (const candidate of vocabulary) {
    // Skip if length difference already exceeds max distance
    if (Math.abs(candidate.length - word.length) > maxDistance) continue;
    const dist = levenshtein(word, candidate);
    if (dist < bestDist) {
      bestDist = dist;
      best = candidate;
    }
  }
  return bestDist <= maxDistance ? best : null;
}

/**
 * Build a vocabulary of canonical words from the product catalog.
 * Used as the target for fuzzy matching.
 */
export function buildVocabulary(products: { name?: string | null; vehicleMake?: string | null; vehicleModel?: string | null }[]): string[] {
  const vocab = new Set<string>();
  for (const p of products) {
    if (p.vehicleMake) vocab.add(p.vehicleMake.toLowerCase().trim());
    if (p.vehicleModel) vocab.add(p.vehicleModel.toLowerCase().trim());
    if (p.name) {
      p.name.toLowerCase().split(/\s+/).forEach(w => {
        const clean = w.replace(/[^a-z0-9-]/g, '');
        if (clean.length >= 3 && !STOP_WORDS.has(clean)) vocab.add(clean);
      });
    }
  }
  // Add canonical synonym targets so we can fuzzy-match against them
  Object.values(SYNONYMS).forEach(v => {
    v.split(/\s+/).forEach(w => { if (w.length >= 3) vocab.add(w); });
  });
  return [...vocab];
}

/**
 * Normalize a search query through all three passes.
 * Returns the normalized form and the list of tokens.
 */
export function normalizeQuery(raw: string, vocabulary: string[]): { normalized: string; tokens: string[] } {
  if (!raw || typeof raw !== 'string') return { normalized: '', tokens: [] };

  // Pass 1: lowercase, strip punctuation, collapse whitespace
  let text = raw.toLowerCase().trim();
  text = text.replace(/[^\w\s-]/g, ' '); // punctuation → space
  text = text.replace(/\s+/g, ' ').trim();

  // Pass 2: tokenize, filter stop words and very short tokens
  const rawTokens = text.split(/\s+/).filter(t => t.length >= 2 && !STOP_WORDS.has(t));

  // Pass 3: for each token, apply synonyms, then fuzzy-match against catalog
  const normalized: string[] = [];
  for (const token of rawTokens) {
    // Exact synonym hit
    if (SYNONYMS[token]) {
      // Synonym may expand to multiple words ("brake pad")
      SYNONYMS[token].split(/\s+/).forEach(w => normalized.push(w));
      continue;
    }
    // Fuzzy match against catalog vocabulary
    const match = fuzzyMatch(token, vocabulary);
    if (match) {
      normalized.push(match);
    } else {
      // Keep the original token — might be valid, just not in catalog yet
      normalized.push(token);
    }
  }

  // Dedupe while preserving order
  const seen = new Set<string>();
  const unique = normalized.filter(t => {
    if (seen.has(t)) return false;
    seen.add(t);
    return true;
  });

  return {
    normalized: unique.join(' '),
    tokens: unique,
  };
}

// ─── Normalization cache ──────────────────────────────────────────
// Cleared when the vocabulary changes (new products added).
let vocabCache: string[] | null = null;
let vocabFingerprint: string | null = null;
const queryCache = new Map<string, { normalized: string; tokens: string[] }>();

/**
 * Normalize a query using a cached vocabulary. If the vocabulary
 * fingerprint changes, the cache is invalidated.
 */
export function normalizeQueryCached(raw: string, products: { name?: string | null; vehicleMake?: string | null; vehicleModel?: string | null }[]): { normalized: string; tokens: string[] } {
  // Cheap fingerprint: product count + first/last product name
  const fp = `${products.length}:${products[0]?.name ?? ''}:${products[products.length - 1]?.name ?? ''}`;
  if (fp !== vocabFingerprint) {
    vocabCache = buildVocabulary(products);
    vocabFingerprint = fp;
    queryCache.clear();
  }
  const key = raw.toLowerCase().trim();
  const cached = queryCache.get(key);
  if (cached) return cached;
  const result = normalizeQuery(raw, vocabCache!);
  queryCache.set(key, result);
  return result;
}
