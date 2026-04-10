import { LightningElement, api, wire } from 'lwc';
import executeSingleValueQuery from '@salesforce/apex/ChartQueryController.executeSingleValueQuery';
import CURRENCY from '@salesforce/i18n/currency';
import LOCALE from '@salesforce/i18n/locale';
import { formatValue, isCurrencyPrefix, getCurrencySymbol } from 'c/chartUtils';

export default class MetricCard extends LightningElement {
    @api chartTitle = '';
    @api query = '';
    @api valuePrefix = '';
    @api valueSuffix = '';
    @api iconName = 'utility:analytics';
    @api iconColor = '#4ecdc4';
    @api trendQuery = '';
    @api trendSuffix = '';
    @api recordId = '';

    _mainValue = null;
    _mainError;
    _mainWired = false;

    _trendValue = null;
    _trendError;
    _trendWired = false;

    @wire(executeSingleValueQuery, { query: '$query', recordId: '$recordId' })
    wiredMain({ data, error }) {
        this._mainWired = true;
        if (data !== undefined) {
            this._mainValue = data;
            this._mainError = undefined;
        } else if (error) {
            this._mainError = error;
            this._mainValue = null;
        }
    }

    get _safeTrendQuery() {
        return this.trendQuery || '';
    }

    @wire(executeSingleValueQuery, { query: '$_safeTrendQuery', recordId: '$recordId' })
    wiredTrend({ data, error }) {
        if (!this.trendQuery) return;
        this._trendWired = true;
        if (data !== undefined) {
            this._trendValue = data;
            this._trendError = undefined;
        } else if (error) {
            this._trendError = error;
            this._trendValue = null;
        }
    }

    get resolvedPrefix() {
        if (isCurrencyPrefix(this.valuePrefix)) {
            return getCurrencySymbol(LOCALE, CURRENCY);
        }
        return this.valuePrefix || '';
    }

    get hasData() {
        return this._mainValue !== null && this._mainValue !== undefined;
    }

    get isLoading() {
        return !this._mainWired;
    }

    get errorMessage() {
        if (!this._mainError) return '';
        return this._mainError.body ? this._mainError.body.message : this._mainError.message;
    }

    get formattedValue() {
        return formatValue(this._mainValue, {
            prefix: this.resolvedPrefix,
            suffix: this.valueSuffix,
            abbreviate: false
        });
    }

    get _trendDelta() {
        if (this._mainValue == null || this._trendValue == null) return null;
        return this._mainValue - this._trendValue;
    }

    get hasTrend() {
        return this.trendQuery && this._trendDelta !== null && this._trendDelta !== 0;
    }

    get trendIconName() {
        return this._trendDelta > 0 ? 'utility:arrowup' : 'utility:arrowdown';
    }

    get trendText() {
        const abs = Math.abs(this._trendDelta);
        return formatValue(abs, { suffix: this.trendSuffix || '', abbreviate: false });
    }

    get trendClass() {
        return this._trendDelta > 0 ? 'trend trend-positive' : 'trend trend-negative';
    }

    get iconBackgroundStyle() {
        const color = this.iconColor || '#4ecdc4';
        return `background-color: ${color};`;
    }

    get resolvedIconName() {
        const name = this.iconName || 'utility:analytics';
        const parts = name.split(':');
        if (parts.length === 2 && parts[0] !== 'utility') {
            return 'utility:' + parts[1];
        }
        return name;
    }
}
