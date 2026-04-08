/**
 * Shared chart utility functions and constants for chartBuddy LWC suite.
 * All chart components import from this module.
 */

// SLDS-aligned chart color palette
export const CHART_COLORS = [
  '#52B7D8', // Blue
  '#E16032', // Orange
  '#FFB03B', // Yellow
  '#54A77B', // Green
  '#4FD2D2', // Teal
  '#E287B2', // Pink
  '#8F96A3', // Gray
  '#6B92E5', // Periwinkle
  '#D7E17E', // Lime
  '#B6759A', // Mauve
  '#F5E351', // Bright Yellow
  '#E2CE7D'  // Gold
];

// Semantic colors for specific chart types
export const COLORS = {
  primary: '#1B96FF',
  primaryLight: '#D8EDFF',
  secondary: '#A094ED',
  secondaryLight: '#E8E5FA',
  positive: '#2E844A',
  negative: '#C23934',
  neutral: '#B0ADAB',
  neutralLight: '#E5E5E4',
  gaugeTrack: '#E5E5E4',
  gaugeFill: '#1B96FF',
  ratingFilled: '#1B96FF',
  ratingEmpty: '#E5E5E4',
  waterfallStart: '#1B96FF',
  waterfallEnd: '#1B96FF',
  waterfallUp: '#2E844A',
  waterfallDown: '#C23934',
  gridLine: '#E5E5E4',
  axisLine: '#C9C7C5',
  axisText: '#706E6B',
  titleText: '#181818'
};

// Pipeline origami gradient
export const PIPELINE_COLORS = [
  '#032D60', // Darkest blue
  '#0D47A1',
  '#1565C0',
  '#1976D2',
  '#2196F3',
  '#4CAF50'  // Green (final stage)
];

// Stacked/grouped multi-series palette
export const SERIES_COLORS = [
  '#1B96FF', // Blue
  '#A094ED', // Purple/Lavender
  '#E287B2'  // Pink
];

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

function polarToCartesian(cx, cy, r, angleDeg) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(angleRad),
    y: cy + r * Math.sin(angleRad)
  };
}
