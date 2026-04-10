import { LightningElement, api, wire } from 'lwc';
import executeSingleValueQuery from '@salesforce/apex/ChartQueryController.executeSingleValueQuery';
import { COLORS, describeArc, clamp } from 'c/chartUtils';

const CX = 100;
const CY = 100;
const RADIUS = 70;
const ARC_START = 150;
const ARC_END = 390;
const ARC_SPAN = ARC_END - ARC_START;
const STROKE_WIDTH = 16;

export default class PolarGauge extends LightningElement {
    @api chartTitle;
    @api query = '';
    @api maxValue = 100;
    @api valueSuffix = '%';
    @api recordId = '';

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

    get hasData() {
        return this.rawValue !== null && this.rawValue !== undefined;
    }

    get trackPath() {
        return describeArc(CX, CY, RADIUS, ARC_START, ARC_END);
    }

    get fillPath() {
        const max = this.maxValue || 100;
        const ratio = clamp(this.rawValue / max, 0, 1);
        const endAngle = ARC_START + ratio * ARC_SPAN;
        return describeArc(CX, CY, RADIUS, ARC_START, endAngle);
    }

    get displayValue() {
        const val = this.rawValue;
        if (val == null || isNaN(val)) {
            return '';
        }
        return Number.isInteger(val) ? String(val) : val.toFixed(1);
    }

    get displaySuffix() {
        return this.valueSuffix || '';
    }

    get trackColor() {
        return COLORS.gaugeTrack;
    }

    get fillColor() {
        return COLORS.gaugeFill;
    }

    get strokeWidth() {
        return STROKE_WIDTH;
    }

    get titleColor() {
        return COLORS.titleText;
    }
}
