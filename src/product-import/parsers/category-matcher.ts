export interface CategoryMatchCandidate {
  id: string;
  name: string;
  slug: string;
  translations?: {
    mk?: string;
    sq?: string;
    tr?: string;
  } | null;
}

const IGNORED_SOURCE_LABELS = new Set(['uncategorized', 'uncategorised']);

export function normalizeCategoryLabel(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, ' ');
}

function categoryLabels(cat: CategoryMatchCandidate): string[] {
  const labels = [cat.name];
  if (cat.translations?.mk) labels.push(cat.translations.mk);
  if (cat.translations?.sq) labels.push(cat.translations.sq);
  if (cat.translations?.tr) labels.push(cat.translations.tr);
  return [...new Set(labels.map(normalizeCategoryLabel).filter(Boolean))];
}

/**
 * Match a source export category label to a platform category id.
 * 1. Exact match on English name or locale translations
 * 2. Partial match when one label contains the other (min 4 chars)
 */
export function matchCategoryLabel(
  sourceLabel: string,
  categories: CategoryMatchCandidate[],
): string | undefined {
  const normalized = normalizeCategoryLabel(sourceLabel);
  if (!normalized || IGNORED_SOURCE_LABELS.has(normalized)) {
    return undefined;
  }

  for (const cat of categories) {
    if (categoryLabels(cat).includes(normalized)) {
      return cat.id;
    }
  }

  const MIN_PARTIAL = 4;
  let best: { id: string; score: number } | undefined;

  for (const cat of categories) {
    for (const catLabel of categoryLabels(cat)) {
      let score = 0;
      if (
        catLabel.includes(normalized) &&
        normalized.length >= MIN_PARTIAL
      ) {
        score = 50 + normalized.length;
      } else if (
        normalized.includes(catLabel) &&
        catLabel.length >= MIN_PARTIAL
      ) {
        score = 40 + catLabel.length;
      }
      if (score > 0 && (!best || score > best.score)) {
        best = { id: cat.id, score };
      }
    }
  }

  return best?.id;
}

export function buildCategoryMappings(
  sourceLabels: string[],
  categories: CategoryMatchCandidate[],
): Record<string, string> {
  const mappings: Record<string, string> = {};
  for (const label of sourceLabels) {
    const id = matchCategoryLabel(label, categories);
    if (id) mappings[label] = id;
  }
  return mappings;
}
