import { LightningElement, api, wire } from 'lwc';
import executeSingleValueQuery from '@salesforce/apex/ChartQueryController.executeSingleValueQuery';
import CURRENCY from '@salesforce/i18n/currency';
import LOCALE from '@salesforce/i18n/locale';
import { resolveTheme, formatValue, clamp, isCurrencyPrefix, getCurrencySymbol } from 'c/chartUtils';

const BAR_LEFT = 20;
const BAR_RIGHT = 480;
const BAR_WIDTH = BAR_RIGHT - BAR_LEFT;
const BAR_Y = 24;
const BAR_HEIGHT = 24;
const BAR_RADIUS = 12;

export default class FlatGauge extends LightningElement {
    @api chartTitle;
    @api query = '';
    @api maxValue = 100;
    @api referenceValue;
    @api referenceLabel = 'Avg';
    @api valuePrefix = '';
    @api valueSuffix = '';
    @api gradientStops;
    @api recordId = '';
    @api colorTheme = '';

    get _theme() {
        return resolveTheme(this.colorTheme);
    }

    rawValue = null;
    error;

    @wire(executeSingleValueQuery, { query: '$query', recordId: '$recordId' })
    wiredResult({ data, error }) {
        if (data !== undefined) {
            this.rawValue = data;
            this.error = undefined;
        } else if (error) {
            this.error = error;
            this.rawValue = null;
        }
    }

    get resolvedPrefix() {
        if (isCurrencyPrefix(this.valuePrefix)) {
            return getCurrencySymbol(LOCALE, CURRENCY);
        }
        return this.valuePrefix || '';
    }

    get hasData() {
        return this.rawValue !== null && this.rawValue !== undefined;
    }

    get trackX() {
        return BAR_LEFT;
    }

    get trackY() {
        return BAR_Y;
    }

    get trackWidth() {
        return BAR_WIDTH;
    }

    get trackHeight() {
        return BAR_HEIGHT;
    }

    get trackRx() {
        return BAR_RADIUS;
    }

    get trackFill() {
        return this._theme.gaugeTrack;
    }

    get fillX() {
        return BAR_LEFT;
    }

    get fillY() {
        return BAR_Y;
    }

    get fillWidth() {
        const max = this.maxValue || 100;
        const ratio = clamp(this.rawValue / max, 0, 1);
        return ratio * BAR_WIDTH;
    }

    get fillHeight() {
        return BAR_HEIGHT;
    }

    get fillRx() {
        return BAR_RADIUS;
    }

    get hasGradient() {
        return !!this.gradientStops;
    }

    get fillColor() {
        if (this.hasGradient) return 'url(#flat-gauge-grad)';
        return this._theme.gaugeFill;
    }

    _gradientSynced = false;

    renderedCallback() {
        if (this.hasGradient && !this._gradientSynced && this.hasData) {
            this._syncGradient();
        }
    }

    _syncGradient() {
        const defs = this.template.querySelector('.gauge-defs');
        if (!defs) return;
        while (defs.firstChild) {
            defs.removeChild(defs.firstChild);
        }
        const ns = 'http://www.w3.org/2000/svg';
        const stops = this.gradientStops.split(',').map(s => s.trim()).filter(Boolean);
        if (!stops.length) return;
        const grad = document.createElementNS(ns, 'linearGradient');
        grad.setAttribute('id', 'flat-gauge-grad');
        grad.setAttribute('x1', '0');
        grad.setAttribute('y1', '0');
        grad.setAttribute('x2', '1');
        grad.setAttribute('y2', '0');
        stops.forEach((color, idx) => {
            const stop = document.createElementNS(ns, 'stop');
            const offset = stops.length === 1 ? '100%' : `${Math.round((idx / (stops.length - 1)) * 100)}%`;
            stop.setAttribute('offset', offset);
            stop.setAttribute('stop-color', color);
            grad.appendChild(stop);
        });
        defs.appendChild(grad);
        this._gradientSynced = true;
    }

    get valueText() {
        return formatValue(this.rawValue, {
            prefix: this.resolvedPrefix,
            suffix: this.valueSuffix || '',
            abbreviate: true
        });
    }

    get valueLabelX() {
        return BAR_RIGHT + 10;
    }

    get valueLabelY() {
        return BAR_Y + BAR_HEIGHT / 2 + 6;
    }

    get hasSuperscript() {
        return !!this.targetText || this.hasVariance;
    }

    get superscriptX() {
        const charCount = this.valueText.length;
        return BAR_RIGHT + 12 + charCount * 10;
    }

    get superscriptY() {
        return BAR_Y + BAR_HEIGHT / 2 + 2;
    }

    get targetText() {
        const target = this.hasReference ? this.referenceValue : this.maxValue;
        if (!target) return '';
        const formatted = formatValue(Number(target), {
            prefix: this.resolvedPrefix,
            suffix: this.valueSuffix || '',
            abbreviate: true
        });
        return `of ${formatted}`;
    }

    get targetLabelY() {
        return BAR_Y + BAR_HEIGHT / 2 + 20;
    }

    get hasVariance() {
        if (!this.hasData) return false;
        const target = this.hasReference ? Number(this.referenceValue) : Number(this.maxValue);
        return target > 0;
    }

    get _variancePct() {
        const target = this.hasReference ? Number(this.referenceValue) : Number(this.maxValue);
        if (!target) return 0;
        return Math.round(((this.rawValue - target) / target) * 100);
    }

    get varianceText() {
        const pct = this._variancePct;
        const arrow = pct >= 0 ? '\u25B2' : '\u25BC';
        return `${arrow} ${Math.abs(pct)}%`;
    }

    get varianceColor() {
        return this._variancePct >= 0 ? this._theme.positive : this._theme.negative;
    }

    get varianceX() {
        return BAR_RIGHT + 10;
    }

    get varianceLabelY() {
        return BAR_Y + BAR_HEIGHT / 2 + 33;
    }

    get belowBarY() {
        return BAR_Y + BAR_HEIGHT + 16;
    }

    get trackEndX() {
        return BAR_RIGHT;
    }

    get referenceValueText() {
        if (!this.hasReference) return '';
        return formatValue(Number(this.referenceValue), {
            prefix: this.resolvedPrefix,
            suffix: this.valueSuffix || '',
            abbreviate: true
        });
    }

    get hasReference() {
        return (
            this.referenceValue !== undefined &&
            this.referenceValue !== null &&
            this.referenceValue !== ''
        );
    }

    get referenceX() {
        const max = this.maxValue || 100;
        const ratio = clamp(this.referenceValue / max, 0, 1);
        return BAR_LEFT + ratio * BAR_WIDTH;
    }

    get referenceLineY1() {
        return BAR_Y - 2;
    }

    get referenceLineY2() {
        return BAR_Y + BAR_HEIGHT + 2;
    }

    get referenceLabelY() {
        return BAR_Y + BAR_HEIGHT / 2 + 18;
    }

    get titleColor() {
        return '#181818';
    }

    get axisTextColor() {
        return '#706e6b';
    }
}
