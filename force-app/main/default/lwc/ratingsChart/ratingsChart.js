import { LightningElement, api, wire } from 'lwc';
import executeSingleValueQuery from '@salesforce/apex/ChartQueryController.executeSingleValueQuery';
import { resolveTheme, clamp } from 'c/chartUtils';

const DOT_RADIUS = 12;
const DOT_DIAMETER = DOT_RADIUS * 2;
const DOT_GAP = 8;
const DOT_CY = 16;

export default class RatingsChart extends LightningElement {
    @api chartTitle;
    @api query = '';
    @api maxDots = 10;
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

    get hasData() {
        return this.rawValue !== null && this.rawValue !== undefined;
    }

    get filledCount() {
        const total = this.maxDots || 10;
        return Math.round(clamp(this.rawValue, 0, total));
    }

    get dots() {
        const total = this.maxDots || 10;
        const filled = this.filledCount;
        const result = [];
        for (let i = 0; i < total; i++) {
            result.push({
                key: `dot-${i}`,
                cx: DOT_RADIUS + i * (DOT_DIAMETER + DOT_GAP),
                cy: DOT_CY,
                r: DOT_RADIUS,
                fill: i < filled ? this._theme.ratingFilled : this._theme.ratingEmpty
            });
        }
        return result;
    }

    get svgWidth() {
        const total = this.maxDots || 10;
        return total * DOT_DIAMETER + (total - 1) * DOT_GAP;
    }

    get viewBox() {
        return `0 0 ${this.svgWidth} 50`;
    }

    get titleColor() {
        return '#181818';
    }
}
