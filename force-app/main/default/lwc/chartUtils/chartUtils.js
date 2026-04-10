/**
 * Shared chart utility functions and constants for chartBuddy LWC suite.
 * All chart components import from this module.
 */

/**
 * Color themes for Chart Buddy.
 * Each theme provides: series (12 data series colors), semantic colors,
 * pipeline gradient, and gauge/rating fills.
 */
export const COLOR_THEMES = {
  salesforce: {
    label: 'Salesforce (Default)',
    series: ['#52B7D8','#E16032','#FFB03B','#54A77B','#4FD2D2','#E287B2','#8F96A3','#6B92E5','#D7E17E','#B6759A','#F5E351','#E2CE7D'],
    primary: '#1B96FF', primaryLight: '#D8EDFF',
    secondary: '#A094ED', secondaryLight: '#E8E5FA',
    positive: '#2E844A', negative: '#C23934',
    gaugeTrack: '#E5E5E4', gaugeFill: '#1B96FF',
    ratingFilled: '#1B96FF', ratingEmpty: '#E5E5E4',
    pipeline: ['#032D60','#0D47A1','#1565C0','#1976D2','#2196F3','#4CAF50'],
    waterfallUp: '#2E844A', waterfallDown: '#C23934', waterfallStart: '#1B96FF'
  },
  bluegrass: {
    label: 'Bluegrass',
    series: ['#00716B','#0B5394','#4A154B','#C2185B','#F57C00','#0097A7','#689F38','#5C6BC0','#FF7043','#26A69A','#AB47BC','#FFA726'],
    primary: '#0B5394', primaryLight: '#D0E4F5',
    secondary: '#4A154B', secondaryLight: '#E8D5E8',
    positive: '#689F38', negative: '#C2185B',
    gaugeTrack: '#E5E5E4', gaugeFill: '#0B5394',
    ratingFilled: '#0B5394', ratingEmpty: '#E5E5E4',
    pipeline: ['#00363A','#00524F','#00716B','#0B5394','#4A154B','#689F38'],
    waterfallUp: '#689F38', waterfallDown: '#C2185B', waterfallStart: '#0B5394'
  },
  wildflowers: {
    label: 'Wildflowers',
    series: ['#BA68C8','#FF7043','#FFD54F','#4DB6AC','#7986CB','#F06292','#A1887F','#90A4AE','#AED581','#CE93D8','#FFB74D','#80DEEA'],
    primary: '#BA68C8', primaryLight: '#F3E5F5',
    secondary: '#FF7043', secondaryLight: '#FBE9E7',
    positive: '#4DB6AC', negative: '#F06292',
    gaugeTrack: '#E5E5E4', gaugeFill: '#BA68C8',
    ratingFilled: '#BA68C8', ratingEmpty: '#E5E5E4',
    pipeline: ['#4A148C','#6A1B9A','#7B1FA2','#8E24AA','#AB47BC','#4DB6AC'],
    waterfallUp: '#4DB6AC', waterfallDown: '#F06292', waterfallStart: '#BA68C8'
  },
  ocean: {
    label: 'Ocean',
    series: ['#0077B6','#00B4D8','#90E0EF','#023E8A','#48CAE4','#ADE8F4','#03045E','#0096C7','#CAF0F8','#005F73','#94D2BD','#E9D8A6'],
    primary: '#0077B6', primaryLight: '#CAF0F8',
    secondary: '#023E8A', secondaryLight: '#D0E4F5',
    positive: '#94D2BD', negative: '#AE2012',
    gaugeTrack: '#E5E5E4', gaugeFill: '#0077B6',
    ratingFilled: '#0077B6', ratingEmpty: '#E5E5E4',
    pipeline: ['#03045E','#023E8A','#0077B6','#0096C7','#00B4D8','#94D2BD'],
    waterfallUp: '#94D2BD', waterfallDown: '#AE2012', waterfallStart: '#0077B6'
  },
  sunset: {
    label: 'Sunset',
    series: ['#FF6B6B','#FFA07A','#FFD93D','#6BCB77','#4D96FF','#9B59B6','#F39C12','#E74C3C','#1ABC9C','#3498DB','#E67E22','#2ECC71'],
    primary: '#FF6B6B', primaryLight: '#FFE0E0',
    secondary: '#4D96FF', secondaryLight: '#D6E8FF',
    positive: '#6BCB77', negative: '#E74C3C',
    gaugeTrack: '#E5E5E4', gaugeFill: '#FF6B6B',
    ratingFilled: '#FF6B6B', ratingEmpty: '#E5E5E4',
    pipeline: ['#C0392B','#E74C3C','#FF6B6B','#FFA07A','#FFD93D','#6BCB77'],
    waterfallUp: '#6BCB77', waterfallDown: '#E74C3C', waterfallStart: '#FF6B6B'
  },
  accessible: {
    label: 'Accessible (High Contrast)',
    series: ['#003F5C','#58508D','#BC5090','#FF6361','#FFA600','#374C80','#7A5195','#EF5675','#FFC300','#2F4B7C','#665191','#F95D6A'],
    primary: '#003F5C', primaryLight: '#D0E8F2',
    secondary: '#58508D', secondaryLight: '#E0DDF0',
    positive: '#2F4B7C', negative: '#FF6361',
    gaugeTrack: '#E5E5E4', gaugeFill: '#003F5C',
    ratingFilled: '#003F5C', ratingEmpty: '#E5E5E4',
    pipeline: ['#003F5C','#374C80','#58508D','#7A5195','#BC5090','#FFA600'],
    waterfallUp: '#2F4B7C', waterfallDown: '#FF6361', waterfallStart: '#003F5C'
  },
  monochrome: {
    label: 'Monochrome',
    series: ['#1A1A2E','#3D3D5C','#5C5C7A','#7A7A99','#9999B3','#B3B3CC','#484871','#6666A3','#8585B5','#A3A3C7','#C2C2D9','#E0E0EB'],
    primary: '#1A1A2E', primaryLight: '#E0E0EB',
    secondary: '#5C5C7A', secondaryLight: '#D6D6E4',
    positive: '#3D3D5C', negative: '#1A1A2E',
    gaugeTrack: '#E5E5E4', gaugeFill: '#1A1A2E',
    ratingFilled: '#1A1A2E', ratingEmpty: '#E5E5E4',
    pipeline: ['#1A1A2E','#3D3D5C','#5C5C7A','#7A7A99','#9999B3','#B3B3CC'],
    waterfallUp: '#5C5C7A', waterfallDown: '#1A1A2E', waterfallStart: '#3D3D5C'
  },
  earth: {
    label: 'Earth Tones',
    series: ['#8B4513','#CD853F','#DEB887','#556B2F','#6B8E23','#BC8F8F','#A0522D','#D2B48C','#8FBC8F','#B8860B','#DAA520','#F4A460'],
    primary: '#8B4513', primaryLight: '#F5E6D3',
    secondary: '#556B2F', secondaryLight: '#E0E8D1',
    positive: '#6B8E23', negative: '#A0522D',
    gaugeTrack: '#E5E5E4', gaugeFill: '#8B4513',
    ratingFilled: '#8B4513', ratingEmpty: '#E5E5E4',
    pipeline: ['#3E2723','#5D4037','#795548','#8D6E63','#A1887F','#6B8E23'],
    waterfallUp: '#6B8E23', waterfallDown: '#A0522D', waterfallStart: '#8B4513'
  }
};

// Default theme key
export const DEFAULT_THEME = 'salesforce';

/**
 * Resolve a theme by key, falling back to salesforce default.
 * @param {string} themeKey - Theme name from COLOR_THEMES
 * @returns {object} The resolved theme object
 */
export function resolveTheme(themeKey) {
  return COLOR_THEMES[themeKey] || COLOR_THEMES[DEFAULT_THEME];
}

/**
 * Get the color theme options for a combobox.
 * @returns {Array<{label: string, value: string}>}
 */
export function getThemeOptions() {
  return Object.entries(COLOR_THEMES).map(([key, theme]) => ({
    label: theme.label,
    value: key
  }));
}

// Legacy exports -- resolve from default theme for backward compatibility
const _default = COLOR_THEMES.salesforce;
export const CHART_COLORS = _default.series;
export const COLORS = {
  primary: _default.primary,
  primaryLight: _default.primaryLight,
  secondary: _default.secondary,
  secondaryLight: _default.secondaryLight,
  positive: _default.positive,
  negative: _default.negative,
  neutral: '#B0ADAB',
  neutralLight: '#E5E5E4',
  gaugeTrack: _default.gaugeTrack,
  gaugeFill: _default.gaugeFill,
  ratingFilled: _default.ratingFilled,
  ratingEmpty: _default.ratingEmpty,
  waterfallStart: _default.waterfallStart,
  waterfallEnd: _default.waterfallStart,
  waterfallUp: _default.waterfallUp,
  waterfallDown: _default.waterfallDown,
  gridLine: '#E5E5E4',
  axisLine: '#C9C7C5',
  axisText: '#706E6B',
  titleText: '#181818'
};
export const PIPELINE_COLORS = _default.pipeline;
export const SERIES_COLORS = [_default.primary, _default.secondary, _default.series[5]];

/**
 * Format a number for axis labels.
 * 150000 -> "$150K", 2500000 -> "$2.5M"
 */
export function formatValue(value, { prefix = '', suffix = '', abbreviate = true } = {}) {
  if (value == null || isNaN(value)) return '';
  let formatted;
  const abs = Math.abs(value);
  if (!abbreviate) {
    formatted = value.toLocaleString();
  } else if (abs >= 1e9) {
    formatted = (value / 1e9).toFixed(abs >= 1e10 ? 0 : 1).replace(/\.0$/, '') + 'B';
  } else if (abs >= 1e6) {
    formatted = (value / 1e6).toFixed(abs >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
  } else if (abs >= 1e3) {
    formatted = (value / 1e3).toFixed(abs >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'K';
  } else {
    formatted = value.toFixed(Number.isInteger(value) ? 0 : 1);
  }
  return `${prefix}${formatted}${suffix}`;
}

/**
 * Compute nice axis tick values for a given data range.
 * Returns array of tick values from 0 to a rounded max.
 */
export function computeTicks(maxValue, tickCount = 5) {
  if (maxValue <= 0) return [0];
  const rawStep = maxValue / (tickCount - 1);
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const residual = rawStep / magnitude;
  let niceStep;
  if (residual <= 1.5) niceStep = magnitude;
  else if (residual <= 3) niceStep = 2 * magnitude;
  else if (residual <= 7) niceStep = 5 * magnitude;
  else niceStep = 10 * magnitude;
  const niceMax = Math.ceil(maxValue / niceStep) * niceStep;
  const ticks = [];
  for (let v = 0; v <= niceMax; v += niceStep) {
    ticks.push(Math.round(v * 1e10) / 1e10);
  }
  return ticks;
}

/**
 * Map raw query results to chart-consumable data.
 * Handles both AggregateResult-style and raw SObject rows.
 */
export function mapQueryResults(results, labelField, valueField) {
  if (!results || !results.length) return [];
  return results.map((row, idx) => ({
    label: String(row[labelField] || row.label || `Item ${idx + 1}`),
    value: Number(row[valueField] || row.value || 0)
  }));
}

/**
 * Group multi-series data by label for stacked/grouped charts.
 * Input: [{label, series, value}, ...]
 * Output: { labels: [...], seriesNames: [...], matrix: [[v,v,...], ...] }
 */
export function groupSeriesData(results, labelField, valueField, seriesField) {
  if (!results || !results.length) return { labels: [], seriesNames: [], matrix: [] };
  const labelSet = new Set();
  const seriesSet = new Set();
  const dataMap = new Map();
  for (const row of results) {
    const label = String(row[labelField] || '');
    const series = String(row[seriesField] || '');
    const value = Number(row[valueField] || 0);
    labelSet.add(label);
    seriesSet.add(series);
    dataMap.set(`${label}||${series}`, value);
  }
  const labels = [...labelSet];
  const seriesNames = [...seriesSet];
  const matrix = labels.map(label =>
    seriesNames.map(series => dataMap.get(`${label}||${series}`) || 0)
  );
  return { labels, seriesNames, matrix };
}

/**
 * Generate a unique key for template iteration.
 */
let _keyCounter = 0;
export function uniqueKey(prefix = 'k') {
  _keyCounter += 1;
  return `${prefix}-${_keyCounter}`;
}

/**
 * Clamp a value between min and max.
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Known single-character currency symbols.
 * When valuePrefix matches one of these (or "currency"/"auto"),
 * the component should resolve via getCurrencySymbol instead.
 */
const CURRENCY_SYMBOLS = new Set([
  '$', '\u20AC', '\u00A3', '\u00A5', '\u20B9', '\u20A9', '\u20BD', '\u20BA', '\u0E3F', '\u20AB', '\u20B1', '\u20AA'
]);

/**
 * Returns true if the given prefix string looks like a currency indicator
 * that should be resolved to the running user's locale currency symbol.
 */
export function isCurrencyPrefix(prefix) {
  if (!prefix) return false;
  const trimmed = prefix.trim();
  if (trimmed.toLowerCase() === 'currency' || trimmed.toLowerCase() === 'auto') return true;
  return CURRENCY_SYMBOLS.has(trimmed);
}

/**
 * Extract the narrow currency symbol for a given locale and ISO currency code.
 * Uses Intl.NumberFormat to produce locale-correct output (e.g. en-US/USD -> "$",
 * de-DE/EUR -> "\u20AC", ja-JP/JPY -> "\uFFE5").
 */
export function getCurrencySymbol(locale, currencyCode) {
  if (!currencyCode) return '$';
  try {
    const parts = new Intl.NumberFormat(locale || 'en-US', {
      style: 'currency',
      currency: currencyCode,
      currencyDisplay: 'narrowSymbol'
    }).formatToParts(0);
    const symbolPart = parts.find(p => p.type === 'currency');
    return symbolPart ? symbolPart.value : currencyCode;
  } catch (e) {
    return currencyCode;
  }
}

/**
 * Describe an SVG arc path for polar gauges.
 * cx, cy: center; r: radius; startAngle, endAngle in degrees (0 = top, clockwise).
 */
export function describeArc(cx, cy, r, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

/**
 * Distribute column widths proportionally to fill a 12-column grid.
 * Each column's configured width is treated as a ratio. The output
 * widths sum to exactly 12, with remainders distributed to the
 * largest columns.
 * @param {number[]} widths - Array of configured widths (1-12 each)
 * @returns {number[]} - Adjusted widths that sum to 12
 */
export function distributeWidths(widths) {
  if (!widths || widths.length === 0) return [];
  const total = widths.reduce((sum, w) => sum + (w || 1), 0);
  if (total === 12) return widths.map(w => w || 1);

  // Compute proportional widths with floor, minimum 1
  const scaled = widths.map(w => {
    const raw = ((w || 1) / total) * 12;
    return Math.max(1, Math.floor(raw));
  });

  // Distribute remainder to columns with the largest fractional parts
  let remainder = 12 - scaled.reduce((sum, w) => sum + w, 0);
  if (remainder > 0) {
    const fractionals = widths.map((w, i) => ({
      index: i,
      frac: (((w || 1) / total) * 12) - scaled[i]
    }));
    fractionals.sort((a, b) => b.frac - a.frac);
    for (let i = 0; i < remainder && i < fractionals.length; i++) {
      scaled[fractionals[i].index]++;
    }
  }

  // If we over-allocated (rounding up from minimum 1), trim the largest
  let excess = scaled.reduce((sum, w) => sum + w, 0) - 12;
  if (excess > 0) {
    const bySize = scaled.map((w, i) => ({ index: i, width: w }));
    bySize.sort((a, b) => b.width - a.width);
    for (let i = 0; i < excess && i < bySize.length; i++) {
      if (scaled[bySize[i].index] > 1) {
        scaled[bySize[i].index]--;
      }
    }
  }

  return scaled;
}

function polarToCartesian(cx, cy, r, angleDeg) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(angleRad),
    y: cy + r * Math.sin(angleRad)
  };
}
