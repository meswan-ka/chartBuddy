import { LightningElement, api, wire } from 'lwc';
import executeRawQuery from '@salesforce/apex/ChartQueryController.executeRawQuery';
import CURRENCY from '@salesforce/i18n/currency';
import LOCALE from '@salesforce/i18n/locale';
import { resolveTheme, formatValue, computeTicks, isCurrencyPrefix, getCurrencySymbol } from 'c/chartUtils';

const SVG_WIDTH = 500;
const DEFAULT_HEIGHT = 150;
const TICK_COUNT = 5;
const PAD_TOP = 20;
const PAD_BOTTOM = 50;
const PAD_LEFT = 60;
const PAD_RIGHT_SINGLE = 20;
const PAD_RIGHT_DUAL = 60;

export default class LineChart extends LightningElement {
    @api chartTitle;
    @api query = '';
    @api labelField;
    @api valueField;
    @api secondaryValueField;
    _showAreaDefault = true;
    @api
    get showArea() {
        return this._showAreaDefault;
    }
    set showArea(value) {
        this._showAreaDefault = value !== false && value !== 'false';
    }
    @api valuePrefix = '';
    @api valueSuffix = '';
    @api secondaryPrefix = '';
    @api secondarySuffix = '';
    @api height = DEFAULT_HEIGHT;
    @api recordId = '';
    @api colorTheme = '';

    get _theme() {
        return resolveTheme(this.colorTheme);
    }

    get _lineColors() {
        return [this._theme.primary, this._theme.secondary, '#E16032', '#54A77B'];
    }

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

    get resolvedPrefix() {
        if (isCurrencyPrefix(this.valuePrefix)) {
            return getCurrencySymbol(LOCALE, CURRENCY);
        }
        return this.valuePrefix || '';
    }

    get resolvedSecondaryPrefix() {
        if (isCurrencyPrefix(this.secondaryPrefix)) {
            return getCurrencySymbol(LOCALE, CURRENCY);
        }
        return this.secondaryPrefix || '';
    }

    get hasData() {
        return this._rawData && this._rawData.length > 0;
    }

    get hasError() {
        return !!this._error;
    }

    get errorMessage() {
        if (!this._error) return '';
        return this._error.body?.message || this._error.message || 'Unknown error';
    }

    get hasDualAxis() {
        return !!this.secondaryValueField;
    }

    get padRight() {
        return this.hasDualAxis ? PAD_RIGHT_DUAL : PAD_RIGHT_SINGLE;
    }

    get chartWidth() {
        return SVG_WIDTH - PAD_LEFT - this.padRight;
    }

    get chartHeight() {
        return (this.height || DEFAULT_HEIGHT) - PAD_TOP - PAD_BOTTOM;
    }

    get viewBox() {
        return `0 0 ${SVG_WIDTH} ${this.height || DEFAULT_HEIGHT}`;
    }

    // -- Data extraction --

    get primaryValues() {
        if (!this._rawData) return [];
        return this._rawData.map(row => Number(row[this.valueField] || 0));
    }

    get secondaryValues() {
        if (!this._rawData || !this.secondaryValueField) return [];
        return this._rawData.map(row => Number(row[this.secondaryValueField] || 0));
    }

    get labels() {
        if (!this._rawData) return [];
        return this._rawData.map(row => String(row[this.labelField] || ''));
    }

    // -- Tick computation --

    get primaryTicks() {
        const vals = this.primaryValues;
        if (!vals.length) return [0];
        return computeTicks(Math.max(...vals), TICK_COUNT);
    }

    get secondaryTicks() {
        const vals = this.secondaryValues;
        if (!vals.length) return [0];
        return computeTicks(Math.max(...vals), TICK_COUNT);
    }

    get primaryMax() {
        const ticks = this.primaryTicks;
        return ticks[ticks.length - 1] || 1;
    }

    get secondaryMax() {
        const ticks = this.secondaryTicks;
        return ticks[ticks.length - 1] || 1;
    }

    // -- Point calculation helpers --

    _xForIndex(idx) {
        const count = this._rawData.length;
        if (count <= 1) return PAD_LEFT + this.chartWidth / 2;
        return PAD_LEFT + (idx / (count - 1)) * this.chartWidth;
    }

    _yForValue(value, maxVal) {
        if (maxVal === 0) return PAD_TOP + this.chartHeight;
        const ratio = value / maxVal;
        return PAD_TOP + this.chartHeight - ratio * this.chartHeight;
    }

    // -- Polyline / polygon points --

    get primaryLinePoints() {
        return this.primaryValues
            .map((v, i) => `${this._xForIndex(i)},${this._yForValue(v, this.primaryMax)}`)
            .join(' ');
    }

    get primaryAreaPoints() {
        if (!this.primaryValues.length) return '';
        const line = this.primaryValues.map((v, i) =>
            `${this._xForIndex(i)},${this._yForValue(v, this.primaryMax)}`
        );
        const bottomRight = `${this._xForIndex(this.primaryValues.length - 1)},${PAD_TOP + this.chartHeight}`;
        const bottomLeft = `${this._xForIndex(0)},${PAD_TOP + this.chartHeight}`;
        return [...line, bottomRight, bottomLeft].join(' ');
    }

    get secondaryLinePoints() {
        return this.secondaryValues
            .map((v, i) => `${this._xForIndex(i)},${this._yForValue(v, this.secondaryMax)}`)
            .join(' ');
    }

    get secondaryAreaPoints() {
        if (!this.secondaryValues.length) return '';
        const line = this.secondaryValues.map((v, i) =>
            `${this._xForIndex(i)},${this._yForValue(v, this.secondaryMax)}`
        );
        const bottomRight = `${this._xForIndex(this.secondaryValues.length - 1)},${PAD_TOP + this.chartHeight}`;
        const bottomLeft = `${this._xForIndex(0)},${PAD_TOP + this.chartHeight}`;
        return [...line, bottomRight, bottomLeft].join(' ');
    }

    // -- Colors --

    get primaryColor() {
        return this._lineColors[0];
    }

    get secondaryColor() {
        return this._lineColors[1];
    }

    get primaryAreaFill() {
        return this._lineColors[0];
    }

    get secondaryAreaFill() {
        return this._lineColors[1];
    }

    // -- Grid lines --

    get gridLines() {
        return this.primaryTicks.map((tick, idx) => {
            const y = this._yForValue(tick, this.primaryMax);
            return {
                key: `grid-${idx}`,
                x1: PAD_LEFT,
                y1: y,
                x2: SVG_WIDTH - this.padRight,
                y2: y
            };
        });
    }

    // -- Y axis labels (primary, left side) --

    get yAxisLabels() {
        return this.primaryTicks.map((tick, idx) => ({
            key: `ylab-${idx}`,
            x: PAD_LEFT - 8,
            y: this._yForValue(tick, this.primaryMax) + 4,
            text: formatValue(tick, { prefix: this.resolvedPrefix, suffix: this.valueSuffix })
        }));
    }

    // -- Y axis labels (secondary, right side) --

    get secondaryYAxisLabels() {
        if (!this.hasDualAxis) return [];
        return this.secondaryTicks.map((tick, idx) => ({
            key: `sylab-${idx}`,
            x: SVG_WIDTH - this.padRight + 8,
            y: this._yForValue(tick, this.secondaryMax) + 4,
            text: formatValue(tick, { prefix: this.resolvedSecondaryPrefix, suffix: this.secondarySuffix })
        }));
    }

    // -- X axis labels --

    get xAxisLabels() {
        const allLabels = this.labels;
        if (!allLabels.length) return [];
        // Show up to 8 labels; thin if more
        const maxLabels = 8;
        const step = allLabels.length <= maxLabels ? 1 : Math.ceil(allLabels.length / maxLabels);
        return allLabels
            .map((label, idx) => {
                if (idx % step !== 0 && idx !== allLabels.length - 1) return null;
                return {
                    key: `xlab-${idx}`,
                    x: this._xForIndex(idx),
                    y: PAD_TOP + this.chartHeight + 20,
                    text: this._formatLabel(label)
                };
            })
            .filter(Boolean);
    }

    _formatLabel(label) {
        // Shorten date strings or long labels
        if (label.length > 10) return label.substring(0, 10);
        return label;
    }

    // -- Chart title position --

    get titleX() {
        return SVG_WIDTH / 2;
    }

    get titleY() {
        return (this.height || DEFAULT_HEIGHT) - 10;
    }

    // -- Style bindings --

    get containerStyle() {
        return `width:100%;`;
    }

    // -- SLDS color constants for template --

    get gridColor() {
        return '#e0e0e0';
    }

    get axisTextColor() {
        return '#706e6b';
    }

    get titleColor() {
        return '#181818';
    }
}
