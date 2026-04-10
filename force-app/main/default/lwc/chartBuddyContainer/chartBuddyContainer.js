import { LightningElement, api } from 'lwc';
import getConfigByName from '@salesforce/apex/ChartBuddyConfigController.getConfigByName';
import { distributeWidths } from 'c/chartUtils';

const VALID_CHART_TYPES = new Set([
    'barChart',
    'lineChart',
    'flatGauge',
    'polarGauge',
    'ratingsChart',
    'pipelineChart',
    'waterfallChart',
    'metricCard'
]);

const MAX_COLUMNS = 12;

/**
 * Runtime container that loads a saved Chart Buddy dashboard configuration
 * and renders up to 12 chart components in a responsive lightning-layout grid.
 */
export default class ChartBuddyContainer extends LightningElement {
    @api configName;
    @api recordId;

    containerTitle = 'Chart Dashboard';
    columns = [];
    isLoading = false;
    errorMessage;

    get hasColumns() {
        return this.columns && this.columns.length > 0;
    }

    connectedCallback() {
        if (this.configName) {
            this.loadConfig();
        }
    }

    async loadConfig() {
        this.isLoading = true;
        this.errorMessage = undefined;
        this.columns = [];

        try {
            const record = await getConfigByName({ configName: this.configName });
            if (!record || !record.Config_JSON__c) {
                this.errorMessage = 'Configuration not found or empty for: ' + this.configName;
                return;
            }
            this.parseConfig(record.Config_JSON__c);
        } catch (error) {
            this.errorMessage = this.reduceError(error);
        } finally {
            this.isLoading = false;
        }
    }

    parseConfig(jsonString) {
        let parsed;
        try {
            parsed = JSON.parse(jsonString);
        } catch (e) {
            this.errorMessage = 'Invalid JSON in configuration: ' + e.message;
            return;
        }

        if (parsed.containerTitle) {
            this.containerTitle = parsed.containerTitle;
        }

        if (!Array.isArray(parsed.columns) || parsed.columns.length === 0) {
            this.errorMessage = 'Configuration contains no columns.';
            return;
        }

        const limited = parsed.columns.slice(0, MAX_COLUMNS);
        const valid = limited.filter((col) => col.chartType && VALID_CHART_TYPES.has(col.chartType));
        const rawWidths = valid.map((col) => this.clampWidth(col.width));
        const adjusted = distributeWidths(rawWidths);
        this.columns = valid.map((col, index) => ({
                id: col.id || 'col-' + (index + 1),
                width: this.clampWidth(col.width),
                renderWidth: adjusted[index] || this.clampWidth(col.width),
                config: col.config || {},
                chartType: col.chartType,
                isBarChart: col.chartType === 'barChart',
                isLineChart: col.chartType === 'lineChart',
                isFlatGauge: col.chartType === 'flatGauge',
                isPolarGauge: col.chartType === 'polarGauge',
                isRatingsChart: col.chartType === 'ratingsChart',
                isPipelineChart: col.chartType === 'pipelineChart',
                isWaterfallChart: col.chartType === 'waterfallChart',
                isMetricCard: col.chartType === 'metricCard'
            }));

        if (this.columns.length === 0) {
            this.errorMessage = 'No valid chart columns found in configuration.';
        }
    }

    clampWidth(width) {
        const num = parseInt(width, 10);
        if (isNaN(num) || num < 1) return 6;
        if (num > 12) return 12;
        return num;
    }

    reduceError(error) {
        if (typeof error === 'string') return error;
        if (error?.body?.message) return error.body.message;
        if (error?.message) return error.message;
        return 'An unexpected error occurred.';
    }
}
