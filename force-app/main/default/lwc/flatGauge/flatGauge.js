import { LightningElement, api, wire } from 'lwc';
import executeSingleValueQuery from '@salesforce/apex/ChartQueryController.executeSingleValueQuery';
import CURRENCY from '@salesforce/i18n/currency';
import LOCALE from '@salesforce/i18n/locale';
import { COLORS, formatValue, clamp, isCurrencyPrefix, getCurrencySymbol } from 'c/chartUtils';

const BAR_LEFT = 20;
const BAR_RIGHT = 300;
const BAR_WIDTH = BAR_RIGHT - BAR_LEFT;
const BAR_Y = 24;
const BAR_HEIGHT = 24;
const BAR_RADIUS = 12;

export default class FlatGauge extends LightningElement {
    @api chartTitle;
    @api query;
    @api maxValue = 100;
    @api referenceValue;
    @api referenceLabel = 'Avg';
    @api valuePrefix = '';
    @api valueSuffix = '';
    @api recordId;

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
        return COLORS.gaugeTrack;
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

    get fillColor() {
        return COLORS.gaugeFill;
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
        return BAR_Y + BAR_HEIGHT + 16;
    }

    get titleColor() {
        return COLORS.titleText;
    }

    get axisTextColor() {
        return COLORS.axisText;
    }
}
