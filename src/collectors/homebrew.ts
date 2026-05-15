export interface HomebrewFormulaDetail {
  name: string;
  desc: string;
  homepage: string;
  dependencies: string[];
  build_dependencies: string[];
}

export interface HomebrewCaskDetail {
  token: string;
  desc: string;
  homepage: string;
}

export interface HomebrewFormulaAnalytics {
  formulae: Array<{ formula: string; count: number }>;
}

export interface HomebrewCaskAnalytics {
  casks: Array<{ cask: string; count: number }>;
}

export interface HomebrewAnalyticsItem {
  source: 'HB' | 'HBC';
  sourceKey: string;
  name: string;
  description: string | null;
  language: null;
  url: string | null;
  dependency: boolean;
  metricValue: number;
}

export function resolveFormulaDependency(
  name: string,
  details: Array<{
    name: string;
    dependencies: string[];
    build_dependencies: string[];
  }>
): boolean {
  return details.some((item) => {
    const deps = [...item.dependencies, ...item.build_dependencies];
    return item.name !== name && deps.includes(name);
  });
}

export function collectHomebrewAnalytics(input: {
  formulaAnalytics: HomebrewFormulaAnalytics;
  caskAnalytics: HomebrewCaskAnalytics;
  formulaDetailsByName: Map<string, HomebrewFormulaDetail>;
  caskDetailsByName: Map<string, HomebrewCaskDetail>;
}): HomebrewAnalyticsItem[] {
  const formulaDetails = [...input.formulaDetailsByName.values()];

  const formulas = input.formulaAnalytics.formulae.map((item) => {
    const detail = input.formulaDetailsByName.get(item.formula);

    return {
      source: 'HB' as const,
      sourceKey: item.formula,
      name: item.formula,
      description: detail?.desc ?? null,
      language: null,
      url: detail?.homepage ?? null,
      dependency: resolveFormulaDependency(item.formula, formulaDetails),
      metricValue: item.count
    };
  });

  const casks = input.caskAnalytics.casks.map((item) => {
    const detail = input.caskDetailsByName.get(item.cask);

    return {
      source: 'HBC' as const,
      sourceKey: item.cask,
      name: item.cask,
      description: detail?.desc ?? null,
      language: null,
      url: detail?.homepage ?? null,
      dependency: false,
      metricValue: item.count
    };
  });

  return [...formulas, ...casks];
}

export const HOMEBREW_ANALYTICS_LIMIT = 200;
export const HOMEBREW_CASK_LIMIT = 100;
export const HOMEBREW_DETAIL_CONCURRENCY = 10;

export async function mapWithConcurrency<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;
  let failed = false;

  const worker = async () => {
    while (!failed && index < items.length) {
      const i = index++;
      try {
        results[i] = await fn(items[i]);
      } catch (e) {
        failed = true;
        throw e;
      }
    }
  };

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker()
  );

  const settled = await Promise.allSettled(workers);
  const rejection = settled.find(
    (r): r is PromiseRejectedResult => r.status === 'rejected'
  );
  if (rejection) {
    throw rejection.reason;
  }

  return results;
}

interface RawFormulaAnalytics {
  items: Array<{ formula: string; count: string }>;
}

interface RawCaskAnalytics {
  items: Array<{ cask: string; count: string }>;
}

function parseCount(raw: string): number {
  return parseInt(raw.replace(/,/g, ''), 10) || 0;
}

export async function fetchHomebrewAnalytics(): Promise<HomebrewAnalyticsItem[]> {
  const [formulaRes, caskRes] = await Promise.all([
    fetch('https://formulae.brew.sh/api/analytics/install/30d.json'),
    fetch('https://formulae.brew.sh/api/analytics/cask-install/30d.json')
  ]);

  if (!formulaRes.ok)
    throw new Error(`Homebrew formula analytics fetch failed: ${formulaRes.status}`);
  if (!caskRes.ok)
    throw new Error(`Homebrew cask analytics fetch failed: ${caskRes.status}`);

  const rawFormula = (await formulaRes.json()) as RawFormulaAnalytics;
  const rawCask = (await caskRes.json()) as RawCaskAnalytics;

  const formulaAnalytics: HomebrewFormulaAnalytics = {
    formulae: rawFormula.items
      .slice(0, HOMEBREW_ANALYTICS_LIMIT)
      .map((item) => ({ formula: item.formula, count: parseCount(item.count) }))
  };

  const caskAnalytics: HomebrewCaskAnalytics = {
    casks: rawCask.items
      .slice(0, HOMEBREW_CASK_LIMIT)
      .map((item) => ({ cask: item.cask, count: parseCount(item.count) }))
  };

  const formulaDetailsByName = new Map<string, HomebrewFormulaDetail>();
  const formulaDetails = await mapWithConcurrency(
    formulaAnalytics.formulae,
    async (item) => {
      try {
        const res = await fetch(
          `https://formulae.brew.sh/api/formula/${encodeURIComponent(item.formula)}.json`
        );
        if (!res.ok) return null;
        return (await res.json()) as HomebrewFormulaDetail;
      } catch {
        return null;
      }
    },
    HOMEBREW_DETAIL_CONCURRENCY
  );

  for (const detail of formulaDetails) {
    if (detail) formulaDetailsByName.set(detail.name, detail);
  }

  const caskDetailsByName = new Map<string, HomebrewCaskDetail>();
  const caskDetails = await mapWithConcurrency(
    caskAnalytics.casks,
    async (item) => {
      try {
        const res = await fetch(
          `https://formulae.brew.sh/api/cask/${encodeURIComponent(item.cask)}.json`
        );
        if (!res.ok) return null;
        return (await res.json()) as HomebrewCaskDetail;
      } catch {
        return null;
      }
    },
    HOMEBREW_DETAIL_CONCURRENCY
  );

  for (const detail of caskDetails) {
    if (detail) caskDetailsByName.set(detail.token, detail);
  }

  return collectHomebrewAnalytics({
    formulaAnalytics,
    caskAnalytics,
    formulaDetailsByName,
    caskDetailsByName
  });
}
