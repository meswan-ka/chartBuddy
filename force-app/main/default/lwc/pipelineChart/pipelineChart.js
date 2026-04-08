import { LightningElement, api, wire } from 'lwc';
import executeQueryWithPicklistSort from '@salesforce/apex/ChartQueryController.executeQueryWithPicklistSort';
import CURRENCY from '@salesforce/i18n/currency';
import LOCALE from '@salesforce/i18n/locale';
import { PIPELINE_COLORS, formatValue, isCurrencyPrefix, getCurrencySymbol } from 'c/chartUtils';

export default class PipelineChart extends LightningElement {
    @api chartTitle;
    @api query;
    @api valuePrefix = '$';
    @api valueSuffix = 'm';
    @api objectApiName;
    @api picklistField;
    @api recordId;

    _data = [];
    _error;
    _wired = false;

    @wire(executeQueryWithPicklistSort, {
        query: '$query',
        recordId: '$recordId',
        objectApiName: '$objectApiName',
        picklistFieldName: '$picklistField'
    })
    wiredData({ error, data }) {
        this._wired = true;
        if (data) {
            this._data = data;
            this._error = undefined;
        } else if (error) {
            this._error = error;
            this._data = [];
        }
    }

    get resolvedPrefix() {
        if (isCurrencyPrefix(this.valuePrefix)) {
            return getCurrencySymbol(LOCALE, CURRENCY);
        }
        return this.valuePrefix || '';
    }

    get hasData() {
        return this._data && this._data.length > 0;
    }

    get isLoading() {
        return !this._wired;
    }

    get errorMessage() {
        if (!this._error) return '';
        return this._error.body ? this._error.body.message : this._error.message;
    }

    get chartData() {
        return this._data.map((dp) => ({
            label: dp.label,
            value: dp.value
        }));
    }

    get stages() {
        const data = this.chartData;
        if (!data.length) return [];

        const n = data.length;
        const svgWidth = 600;
        const topPad = 25;
        const bottomPad = 5;
        const chartHeight = 140 - topPad - bottomPad;
        const centerY = topPad + chartHeight / 2;
        const segWidth = svgWidth / n;

        const maxVal = Math.max(...data.map((d) => d.value));
        if (maxVal <= 0) return [];

        // Compute heights: each stage height proportional to its value
        const heights = data.map((d) => (d.value / maxVal) * chartHeight);

        // Interpolate colors across all stages
        const colors = this._interpolateColors(n);

        const chevronDepth = Math.min(segWidth * 0.12, 15);

        return data.map((d, i) => {
            const h = heights[i];
            const nextH = i < n - 1 ? heights[i + 1] : h * 0.7;
            const x1 = i * segWidth;
            const x2 = (i + 1) * segWidth;

            // Pentagon: left edge at full height, right edge steps down
            // with a chevron point where the next stage begins.
            // Shape: topLeft -> topRight -> chevronPoint -> bottomRight -> bottomLeft
            const topLeft = `${x1},${centerY - h / 2}`;
            const topRight = `${x2 - chevronDepth},${centerY - h / 2}`;
            const chevronTop = `${x2},${centerY - nextH / 2}`;
            const chevronBottom = `${x2},${centerY + nextH / 2}`;
            const bottomRight = `${x2 - chevronDepth},${centerY + h / 2}`;
            const bottomLeft = `${x1},${centerY + h / 2}`;

            const slices = [];
            if (i < n - 1) {
                const sliceCount = 8;
                const fadeStart = x1 + segWidth * 0.6;
                const fadeEnd = x2 - chevronDepth;
                const fadeWidth = fadeEnd - fadeStart;
                for (let s = 0; s < sliceCount; s++) {
                    const t = (s + 1) / sliceCount;
                    const sx = fadeStart + (fadeWidth * s) / sliceCount;
                    const sw = fadeWidth / sliceCount + 0.5;
                    const sliceColor = this._lerpHex(colors[i], colors[i + 1], t * 0.6);
                    slices.push({
                        key: `slice-${i}-${s}`,
                        x: sx,
                        y: centerY - h / 2,
                        width: sw,
                        height: h,
                        style: `fill: ${sliceColor};`
                    });
                }
            }

            return {
                key: `stage-${i}`,
                labelKey: `label-${i}`,
                valueKey: `value-${i}`,
                fillStyle: `fill: ${colors[i]};`,
                slices,
                hasSlices: slices.length > 0,
                points: `${topLeft} ${topRight} ${chevronTop} ${chevronBottom} ${bottomRight} ${bottomLeft}`,
                label: d.label,
                valueText: formatValue(d.value, {
                    prefix: this.resolvedPrefix,
                    suffix: this.valueSuffix
                }),
                labelX: x1 + (segWidth - chevronDepth) / 2,
                labelY: 12,
                valueX: x1 + (segWidth - chevronDepth) / 2,
                valueY: centerY
            };
        });
    }

    _interpolateColors(count) {
        if (count <= 1) return [PIPELINE_COLORS[0]];
        if (count <= PIPELINE_COLORS.length) {
            // Pick evenly spaced colors from the palette
            return Array.from({ length: count }, (_, i) => {
                const idx = Math.round((i / (count - 1)) * (PIPELINE_COLORS.length - 1));
                return PIPELINE_COLORS[idx];
            });
        }
        // More stages than palette entries: interpolate hex
        const results = [];
        for (let i = 0; i < count; i++) {
            const t = i / (count - 1);
            const scaledIdx = t * (PIPELINE_COLORS.length - 1);
            const lo = Math.floor(scaledIdx);
            const hi = Math.min(lo + 1, PIPELINE_COLORS.length - 1);
            const frac = scaledIdx - lo;
            results.push(this._lerpHex(PIPELINE_COLORS[lo], PIPELINE_COLORS[hi], frac));
        }
        return results;
    }

    _lerpHex(a, b, t) {
        const parse = (hex) => [
            parseInt(hex.slice(1, 3), 16),
            parseInt(hex.slice(3, 5), 16),
            parseInt(hex.slice(5, 7), 16)
        ];
        const [r1, g1, b1] = parse(a);
        const [r2, g2, b2] = parse(b);
        const r = Math.round(r1 + (r2 - r1) * t);
        const g = Math.round(g1 + (g2 - g1) * t);
        const bl = Math.round(b1 + (b2 - b1) * t);
        const hex = (v) => v.toString(16).padStart(2, '0');
        return `#${hex(r)}${hex(g)}${hex(bl)}`;
    }
}
