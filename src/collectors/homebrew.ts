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
