import { LightningElement, api, wire } from 'lwc';
import executeQueryWithPicklistSort from '@salesforce/apex/ChartQueryController.executeQueryWithPicklistSort';
import CURRENCY from '@salesforce/i18n/currency';
import LOCALE from '@salesforce/i18n/locale';
import { PIPELINE_COLORS, formatValue, isCurrencyPrefix, getCurrencySymbol } from 'c/chartUtils';

export default class PipelineChart extends LightningElement {
    @api chartTitle;
    @api query = '';
    @api valuePrefix = '$';
    @api valueSuffix = 'm';
    @api objectApiName = '';
    @api picklistField = '';
    @api recordId = '';

    _data = [];
    _error;
    _wired = false;

    @wire(executeQueryWithPicklistSort, {
        query: '$query',
        recordId: '$recordId',
        objectApiName: '',
        picklistFieldName: ''
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
            const r = 4;
            const overlap = i > 0 ? r / 2 : 0;
            const x1 = i * segWidth - overlap;
            const x2 = (i + 1) * segWidth;

            // Pentagon vertices
            const tl = { x: x1, y: centerY - h / 2 };
            const tr = { x: x2 - chevronDepth, y: centerY - h / 2 };
            const ct = { x: x2, y: centerY - nextH / 2 };
            const cb = { x: x2, y: centerY + nextH / 2 };
            const br = { x: x2 - chevronDepth, y: centerY + h / 2 };
            const bl = { x: x1, y: centerY + h / 2 };

            const pathD = this._roundedPentagonPath([tl, tr, ct, cb, br, bl], r);

            const gradId = `cb-grad-${i}`;
            const nextColor = i < n - 1 ? colors[i + 1] : colors[i];

            return {
                key: `stage-${i}`,
                labelKey: `label-${i}`,
                valueKey: `value-${i}`,
                gradientFill: `fill: url(#${gradId});`,
                gradId,
                colorStart: colors[i],
                colorEnd: nextColor,
                pathD,
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

    _gradientsSynced = false;

    renderedCallback() {
        if (!this._gradientsSynced && this.hasData) {
            this._syncGradients();
        }
    }

    _syncGradients() {
        const defs = this.template.querySelector('.gradient-defs');
        if (!defs) return;
        while (defs.firstChild) {
            defs.removeChild(defs.firstChild);
        }
        const ns = 'http://www.w3.org/2000/svg';
        const stages = this.stages;
        for (const stage of stages) {
            const grad = document.createElementNS(ns, 'linearGradient');
            grad.setAttribute('id', stage.gradId);
            grad.setAttribute('x1', '0');
            grad.setAttribute('y1', '0');
            grad.setAttribute('x2', '1');
            grad.setAttribute('y2', '0');
            const stop1 = document.createElementNS(ns, 'stop');
            stop1.setAttribute('offset', '60%');
            stop1.setAttribute('stop-color', stage.colorStart);
            const stop2 = document.createElementNS(ns, 'stop');
            stop2.setAttribute('offset', '100%');
            stop2.setAttribute('stop-color', stage.colorEnd);
            grad.appendChild(stop1);
            grad.appendChild(stop2);
            defs.appendChild(grad);
        }
        this._gradientsSynced = true;
    }

    _roundedPentagonPath(pts, radius) {
        const n = pts.length;
        const parts = [];
        for (let i = 0; i < n; i++) {
            const prev = pts[(i - 1 + n) % n];
            const curr = pts[i];
            const next = pts[(i + 1) % n];
            const dx1 = curr.x - prev.x;
            const dy1 = curr.y - prev.y;
            const dx2 = next.x - curr.x;
            const dy2 = next.y - curr.y;
            const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
            const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
            const r = Math.min(radius, len1 / 2, len2 / 2);
            const startX = curr.x - (dx1 / len1) * r;
            const startY = curr.y - (dy1 / len1) * r;
            const endX = curr.x + (dx2 / len2) * r;
            const endY = curr.y + (dy2 / len2) * r;
            if (i === 0) {
                parts.push(`M ${startX} ${startY}`);
            } else {
                parts.push(`L ${startX} ${startY}`);
            }
            parts.push(`Q ${curr.x} ${curr.y} ${endX} ${endY}`);
        }
        parts.push('Z');
        return parts.join(' ');
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
