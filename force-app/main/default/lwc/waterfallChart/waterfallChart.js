import { LightningElement, api, wire } from 'lwc';
import executeQuery from '@salesforce/apex/ChartQueryController.executeQuery';
import CURRENCY from '@salesforce/i18n/currency';
import LOCALE from '@salesforce/i18n/locale';
import { COLORS, formatValue, computeTicks, isCurrencyPrefix, getCurrencySymbol } from 'c/chartUtils';

const PAD_TOP = 20;
const PAD_RIGHT = 20;
const PAD_BOTTOM = 60;
const PAD_LEFT = 60;
const SVG_WIDTH = 500;

export default class WaterfallChart extends LightningElement {
    @api chartTitle;
    @api query = '';
    @api mode = 'delta';
    @api valuePrefix = '$';
    @api valueSuffix;
    @api height = 300;
    @api recordId = '';

    _data = [];
    _error;
    _wired = false;

    @wire(executeQuery, { query: '$query', recordId: '$recordId' })
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

    get svgHeight() {
        return this.height || 300;
    }

    get viewBox() {
        return `0 0 ${SVG_WIDTH} ${this.svgHeight}`;
    }

    get chartBottom() {
        return this.svgHeight - PAD_BOTTOM;
    }

    get titleY() {
        return this.svgHeight - 5;
    }

    get chartData() {
        return this._data.map((dp) => ({
            label: dp.label,
            value: dp.value
        }));
    }

    /**
     * Build waterfall segments with running totals.
     * Delta mode: first/last are anchored totals, middle are deltas.
     * Cumulative mode: each value is a running total; deltas are computed.
     */
    get waterfallSegments() {
        const raw = this.chartData;
        if (!raw.length) return [];

        if (this.mode === 'cumulative') {
            return this._buildCumulativeSegments(raw);
        }
        return this._buildDeltaSegments(raw);
    }

    _buildDeltaSegments(raw) {
        const segments = [];
        let runningTotal = 0;

        for (let i = 0; i < raw.length; i++) {
            const isStart = i === 0;
            const isEnd = i === raw.length - 1;
            const val = raw[i].value;

            if (isStart || isEnd) {
                segments.push({
                    label: raw[i].label,
                    value: val,
                    startY: 0,
                    endY: val,
                    isStart,
                    isEnd,
                    isPositive: true
                });
                runningTotal = isStart ? val : runningTotal;
            } else {
                const startY = runningTotal;
                runningTotal += val;
                segments.push({
                    label: raw[i].label,
                    value: val,
                    startY,
                    endY: runningTotal,
                    isStart: false,
                    isEnd: false,
                    isPositive: val >= 0
                });
            }
        }
        return segments;
    }

    _buildCumulativeSegments(raw) {
        const segments = [];
        for (let i = 0; i < raw.length; i++) {
            const isStart = i === 0;
            const isEnd = i === raw.length - 1;
            const currVal = raw[i].value;
            const prevVal = i > 0 ? raw[i - 1].value : 0;
            const delta = currVal - prevVal;

            if (isStart || isEnd) {
                segments.push({
                    label: raw[i].label,
                    value: currVal,
                    startY: 0,
                    endY: currVal,
                    isStart,
                    isEnd,
                    isPositive: true
                });
            } else {
                segments.push({
                    label: raw[i].label,
                    value: delta,
                    startY: prevVal,
                    endY: currVal,
                    isStart: false,
                    isEnd: false,
                    isPositive: delta >= 0
                });
            }
        }
        return segments;
    }

    get maxValue() {
        const segs = this.waterfallSegments;
        if (!segs.length) return 0;
        let max = 0;
        for (const s of segs) {
            max = Math.max(max, Math.abs(s.startY), Math.abs(s.endY));
        }
        return max;
    }

    get ticks() {
        return computeTicks(this.maxValue);
    }

    get scaleMax() {
        const t = this.ticks;
        return t[t.length - 1] || 1;
    }

    get plotHeight() {
        return this.svgHeight - PAD_TOP - PAD_BOTTOM;
    }

    get plotWidth() {
        return SVG_WIDTH - PAD_LEFT - PAD_RIGHT;
    }

    _yScale(val) {
        return PAD_TOP + this.plotHeight - (val / this.scaleMax) * this.plotHeight;
    }

    get bars() {
        const segs = this.waterfallSegments;
        if (!segs.length) return [];

        const n = segs.length;
        const groupWidth = this.plotWidth / n;
        const barWidth = Math.min(groupWidth * 0.6, 40);
        const barOffset = (groupWidth - barWidth) / 2;

        return segs.map((s, i) => {
            const x = PAD_LEFT + i * groupWidth + barOffset;
            const topVal = Math.max(s.startY, s.endY);
            const botVal = Math.min(s.startY, s.endY);
            const yTop = this._yScale(topVal);
            const yBot = this._yScale(botVal);
            const h = Math.max(yBot - yTop, 1);

            let color;
            if (s.isStart || s.isEnd) {
                color = COLORS.waterfallStart;
            } else if (s.isPositive) {
                color = COLORS.waterfallUp;
            } else {
                color = COLORS.waterfallDown;
            }

            return {
                key: `bar-${i}`,
                x,
                y: yTop,
                width: barWidth,
                barHeight: h,
                style: `fill: ${color};`,
                label: s.label,
                isStart: s.isStart,
                isEnd: s.isEnd,
                isPositive: s.isPositive
            };
        });
    }

    get connectors() {
        const segs = this.waterfallSegments;
        if (segs.length < 2) return [];

        const n = segs.length;
        const groupWidth = this.plotWidth / n;
        const barWidth = Math.min(groupWidth * 0.6, 40);
        const barOffset = (groupWidth - barWidth) / 2;
        const lines = [];

        for (let i = 0; i < segs.length - 1; i++) {
            const connY = this._yScale(segs[i].endY);
            const x1 = PAD_LEFT + i * groupWidth + barOffset + barWidth;
            const x2 = PAD_LEFT + (i + 1) * groupWidth + barOffset;
            lines.push({
                key: `conn-${i}`,
                x1,
                y1: connY,
                x2,
                y2: connY
            });
        }
        return lines;
    }

    get gridLines() {
        return this.ticks.map((val, i) => {
            const y = this._yScale(val);
            return {
                key: `grid-${i}`,
                x1: PAD_LEFT,
                y1: y,
                x2: SVG_WIDTH - PAD_RIGHT,
                y2: y
            };
        });
    }

    get yAxisLabels() {
        return this.ticks.map((val, i) => ({
            key: `yLabel-${i}`,
            x: PAD_LEFT - 6,
            y: this._yScale(val) + 4,
            text: formatValue(val, {
                prefix: this.resolvedPrefix,
                suffix: this.valueSuffix || ''
            })
        }));
    }

    get xAxisLabels() {
        const segs = this.waterfallSegments;
        if (!segs.length) return [];

        const n = segs.length;
        const groupWidth = this.plotWidth / n;

        return segs.map((s, i) => {
            const x = PAD_LEFT + i * groupWidth + groupWidth / 2;
            const y = this.chartBottom + 10;
            return {
                key: `xLabel-${i}`,
                x,
                y,
                text: s.label,
                transform: `rotate(-45, ${x}, ${y})`
            };
        });
    }
}
