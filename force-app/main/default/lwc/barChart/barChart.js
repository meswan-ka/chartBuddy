import { LightningElement, api, wire } from 'lwc';
import executeRawQuery from '@salesforce/apex/ChartQueryController.executeRawQuery';
import CURRENCY from '@salesforce/i18n/currency';
import LOCALE from '@salesforce/i18n/locale';
import {
    CHART_COLORS,
    SERIES_COLORS,
    formatValue,
    computeTicks,
    groupSeriesData,
    isCurrencyPrefix,
    getCurrencySymbol
} from 'c/chartUtils';

const SVG_WIDTH = 500;
const DEFAULT_HEIGHT = 300;
const PAD_TOP = 30;
const PAD_RIGHT = 20;
const PAD_BOTTOM = 50;
const PAD_LEFT_VERTICAL = 70;
const PAD_LEFT_HORIZONTAL = 80;
const BAR_GAP_RATIO = 0.3;
const GROUP_INNER_GAP = 2;

/**
 * Bar/column chart component supporting horizontal and vertical orientations
 * with simple, stacked, and grouped variants.
 */
export default class BarChart extends LightningElement {
    @api chartTitle;
    @api query;
    @api labelField;
    @api valueField;
    @api seriesField;
    @api orientation = 'vertical';
    @api variant = 'simple';
    @api valuePrefix;
    @api valueSuffix;
    @api height = DEFAULT_HEIGHT;
    @api recordId;

    _rawData;
    _error;

    @wire(executeRawQuery, { query: '$query', recordId: '$recordId' })
    wiredData({ data, error }) {
        if (data) {
            this._rawData = data;
            this._error = undefined;
        } else if (error) {
            this._error = error;
            this._rawData = undefined;
        }
    }

    // --- Computed layout helpers ---

    get isHorizontal() {
        return this.orientation === 'horizontal';
    }

    get isMultiSeries() {
        return !!this.seriesField;
    }

    get isStacked() {
        return this.variant === 'stacked';
    }

    get isGrouped() {
        return this.variant === 'grouped';
    }

    get resolvedPrefix() {
        if (isCurrencyPrefix(this.valuePrefix)) {
            return getCurrencySymbol(LOCALE, CURRENCY);
        }
        return this.valuePrefix || '';
    }

    get padLeft() {
        return this.isHorizontal ? PAD_LEFT_HORIZONTAL : PAD_LEFT_VERTICAL;
    }

    get chartHeight() {
        return Number(this.height) || DEFAULT_HEIGHT;
    }

    get plotWidth() {
        return SVG_WIDTH - this.padLeft - PAD_RIGHT;
    }

    get plotHeight() {
        return this.chartHeight - PAD_TOP - PAD_BOTTOM;
    }

    get viewBox() {
        return `0 0 ${SVG_WIDTH} ${this.chartHeight}`;
    }

    // --- Data processing ---

    get processedData() {
        if (!this._rawData || !this._rawData.length) return null;

        if (this.isMultiSeries) {
            return groupSeriesData(
                this._rawData,
                this.labelField,
                this.valueField,
                this.seriesField
            );
        }

        const labels = [];
        const values = [];
        for (const row of this._rawData) {
            labels.push(String(row[this.labelField] || ''));
            values.push(Number(row[this.valueField] || 0));
        }
        return { labels, values };
    }

    get maxValue() {
        const data = this.processedData;
        if (!data) return 0;

        if (this.isMultiSeries) {
            if (this.isStacked) {
                let max = 0;
                for (const row of data.matrix) {
                    const sum = row.reduce((a, b) => a + b, 0);
                    if (sum > max) max = sum;
                }
                return max;
            }
            let max = 0;
            for (const row of data.matrix) {
                for (const v of row) {
                    if (v > max) max = v;
                }
            }
            return max;
        }

        return Math.max(0, ...data.values);
    }

    get ticks() {
        return computeTicks(this.maxValue, 5);
    }

    get tickMax() {
        const t = this.ticks;
        return t[t.length - 1] || 1;
    }

    // --- State flags ---

    get hasData() {
        return this.processedData != null && this.processedData.labels.length > 0;
    }

    get isLoading() {
        return !this._rawData && !this._error && this.query;
    }

    get errorMessage() {
        if (!this._error) return '';
        return this._error.body ? this._error.body.message : 'An error occurred loading chart data.';
    }

    get showLegend() {
        return this.isMultiSeries && this.hasData;
    }

    // --- Axis origin & endpoints ---

    get axisOrigin() {
        return { x: this.padLeft, y: PAD_TOP + this.plotHeight };
    }

    get axisEndX() {
        return { x: this.padLeft + this.plotWidth, y: PAD_TOP + this.plotHeight };
    }

    get axisEndY() {
        return { x: this.padLeft, y: PAD_TOP };
    }

    // --- Title position ---

    get titleX() {
        return SVG_WIDTH / 2;
    }

    get titleY() {
        return this.chartHeight - 8;
    }

    // --- Grid lines ---

    get gridLines() {
        const lines = [];
        const t = this.ticks;

        if (this.isHorizontal) {
            for (let i = 0; i < t.length; i++) {
                const xPos = this.padLeft + (t[i] / this.tickMax) * this.plotWidth;
                lines.push({
                    key: `grid-${i}`,
                    x1: xPos,
                    y1: PAD_TOP,
                    x2: xPos,
                    y2: PAD_TOP + this.plotHeight
                });
            }
        } else {
            for (let i = 0; i < t.length; i++) {
                const yPos = PAD_TOP + this.plotHeight - (t[i] / this.tickMax) * this.plotHeight;
                lines.push({
                    key: `grid-${i}`,
                    x1: this.padLeft,
                    y1: yPos,
                    x2: this.padLeft + this.plotWidth,
                    y2: yPos
                });
            }
        }

        return lines;
    }

    // --- Axis labels ---

    get xAxisLabels() {
        const data = this.processedData;
        if (!data) return [];

        if (this.isHorizontal) {
            return this.ticks.map((tick, i) => ({
                key: `xlab-${i}`,
                x: this.padLeft + (tick / this.tickMax) * this.plotWidth,
                y: PAD_TOP + this.plotHeight + 18,
                text: formatValue(tick, { prefix: this.resolvedPrefix, suffix: this.valueSuffix || '' }),
                anchor: 'middle'
            }));
        }

        const count = data.labels.length;
        const bandWidth = this.plotWidth / count;
        return data.labels.map((label, i) => ({
            key: `xlab-${i}`,
            x: this.padLeft + bandWidth * i + bandWidth / 2,
            y: PAD_TOP + this.plotHeight + 18,
            text: this._truncateLabel(label, 10),
            anchor: 'middle'
        }));
    }

    get yAxisLabels() {
        const data = this.processedData;
        if (!data) return [];

        if (this.isHorizontal) {
            const count = data.labels.length;
            const bandWidth = this.plotHeight / count;
            return data.labels.map((label, i) => ({
                key: `ylab-${i}`,
                x: this.padLeft - 8,
                y: PAD_TOP + bandWidth * i + bandWidth / 2 + 4,
                text: this._truncateLabel(label, 12),
                anchor: 'end'
            }));
        }

        return this.ticks.map((tick, i) => ({
            key: `ylab-${i}`,
            x: this.padLeft - 8,
            y: PAD_TOP + this.plotHeight - (tick / this.tickMax) * this.plotHeight + 4,
            text: formatValue(tick, { prefix: this.resolvedPrefix, suffix: this.valueSuffix || '' }),
            anchor: 'end'
        }));
    }

    // --- Bars ---

    get computedBars() {
        if (!this.hasData) return [];

        if (this.isMultiSeries) {
            if (this.isStacked) {
                return this._stackedBars();
            }
            if (this.isGrouped) {
                return this._groupedBars();
            }
            return this._simpleMultiSeriesBars();
        }

        return this._simpleBars();
    }

    // --- Legend ---

    get legendItems() {
        const data = this.processedData;
        if (!data || !data.seriesNames) return [];
        return data.seriesNames.map((name, i) => ({
            key: `legend-${i}`,
            color: SERIES_COLORS[i % SERIES_COLORS.length],
            label: name,
            dotStyle: `background-color: ${SERIES_COLORS[i % SERIES_COLORS.length]}`
        }));
    }

    // --- Private bar builders ---

    _simpleBars() {
        const data = this.processedData;
        const count = data.labels.length;
        const color = CHART_COLORS[0];
        const bars = [];

        if (this.isHorizontal) {
            const bandWidth = this.plotHeight / count;
            const barHeight = bandWidth * (1 - BAR_GAP_RATIO);
            const offset = (bandWidth - barHeight) / 2;
            for (let i = 0; i < count; i++) {
                const w = (data.values[i] / this.tickMax) * this.plotWidth;
                bars.push({
                    key: `bar-${i}`,
                    x: this.padLeft,
                    y: PAD_TOP + bandWidth * i + offset,
                    width: Math.max(w, 0),
                    height: barHeight,
                    style: `fill: ${color}`
                });
            }
        } else {
            const bandWidth = this.plotWidth / count;
            const barWidth = bandWidth * (1 - BAR_GAP_RATIO);
            const offset = (bandWidth - barWidth) / 2;
            for (let i = 0; i < count; i++) {
                const h = (data.values[i] / this.tickMax) * this.plotHeight;
                bars.push({
                    key: `bar-${i}`,
                    x: this.padLeft + bandWidth * i + offset,
                    y: PAD_TOP + this.plotHeight - Math.max(h, 0),
                    width: barWidth,
                    height: Math.max(h, 0),
                    style: `fill: ${color}`
                });
            }
        }

        return bars;
    }

    _simpleMultiSeriesBars() {
        // Multi-series but variant=simple: aggregate by label, use first series color
        return this._stackedBars();
    }

    _stackedBars() {
        const data = this.processedData;
        const count = data.labels.length;
        const seriesCount = data.seriesNames.length;
        const bars = [];

        if (this.isHorizontal) {
            const bandWidth = this.plotHeight / count;
            const barHeight = bandWidth * (1 - BAR_GAP_RATIO);
            const offset = (bandWidth - barHeight) / 2;
            for (let i = 0; i < count; i++) {
                let cumulative = 0;
                for (let s = 0; s < seriesCount; s++) {
                    const val = data.matrix[i][s];
                    const w = (val / this.tickMax) * this.plotWidth;
                    const xStart = this.padLeft + (cumulative / this.tickMax) * this.plotWidth;
                    bars.push({
                        key: `bar-${i}-${s}`,
                        x: xStart,
                        y: PAD_TOP + bandWidth * i + offset,
                        width: Math.max(w, 0),
                        height: barHeight,
                        style: `fill: ${SERIES_COLORS[s % SERIES_COLORS.length]}`
                    });
                    cumulative += val;
                }
            }
        } else {
            const bandWidth = this.plotWidth / count;
            const barWidth = bandWidth * (1 - BAR_GAP_RATIO);
            const offset = (bandWidth - barWidth) / 2;
            for (let i = 0; i < count; i++) {
                let cumulative = 0;
                for (let s = 0; s < seriesCount; s++) {
                    const val = data.matrix[i][s];
                    const h = (val / this.tickMax) * this.plotHeight;
                    const yStart = PAD_TOP + this.plotHeight - ((cumulative + val) / this.tickMax) * this.plotHeight;
                    bars.push({
                        key: `bar-${i}-${s}`,
                        x: this.padLeft + bandWidth * i + offset,
                        y: yStart,
                        width: barWidth,
                        height: Math.max(h, 0),
                        style: `fill: ${SERIES_COLORS[s % SERIES_COLORS.length]}`
                    });
                    cumulative += val;
                }
            }
        }

        return bars;
    }

    _groupedBars() {
        const data = this.processedData;
        const count = data.labels.length;
        const seriesCount = data.seriesNames.length;
        const bars = [];

        if (this.isHorizontal) {
            const bandWidth = this.plotHeight / count;
            const groupHeight = bandWidth * (1 - BAR_GAP_RATIO);
            const singleBarHeight = (groupHeight - GROUP_INNER_GAP * (seriesCount - 1)) / seriesCount;
            const groupOffset = (bandWidth - groupHeight) / 2;
            for (let i = 0; i < count; i++) {
                for (let s = 0; s < seriesCount; s++) {
                    const val = data.matrix[i][s];
                    const w = (val / this.tickMax) * this.plotWidth;
                    bars.push({
                        key: `bar-${i}-${s}`,
                        x: this.padLeft,
                        y: PAD_TOP + bandWidth * i + groupOffset + s * (singleBarHeight + GROUP_INNER_GAP),
                        width: Math.max(w, 0),
                        height: singleBarHeight,
                        style: `fill: ${SERIES_COLORS[s % SERIES_COLORS.length]}`
                    });
                }
            }
        } else {
            const bandWidth = this.plotWidth / count;
            const groupWidth = bandWidth * (1 - BAR_GAP_RATIO);
            const singleBarWidth = (groupWidth - GROUP_INNER_GAP * (seriesCount - 1)) / seriesCount;
            const groupOffset = (bandWidth - groupWidth) / 2;
            for (let i = 0; i < count; i++) {
                for (let s = 0; s < seriesCount; s++) {
                    const val = data.matrix[i][s];
                    const h = (val / this.tickMax) * this.plotHeight;
                    bars.push({
                        key: `bar-${i}-${s}`,
                        x: this.padLeft + bandWidth * i + groupOffset + s * (singleBarWidth + GROUP_INNER_GAP),
                        y: PAD_TOP + this.plotHeight - Math.max(h, 0),
                        width: singleBarWidth,
                        height: Math.max(h, 0),
                        style: `fill: ${SERIES_COLORS[s % SERIES_COLORS.length]}`
                    });
                }
            }
        }

        return bars;
    }

    _truncateLabel(label, maxLen) {
        if (!label) return '';
        return label.length > maxLen ? label.substring(0, maxLen - 1) + '\u2026' : label;
    }
}
