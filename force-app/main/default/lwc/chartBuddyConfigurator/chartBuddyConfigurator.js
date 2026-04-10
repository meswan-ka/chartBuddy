import { LightningElement, track, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getConfigs from '@salesforce/apex/ChartBuddyConfigController.getConfigs';
import saveConfig from '@salesforce/apex/ChartBuddyConfigController.saveConfig';
import deleteConfig from '@salesforce/apex/ChartBuddyConfigController.deleteConfig';
import { refreshApex } from '@salesforce/apex';

const CHART_TYPE_OPTIONS = [
    { label: 'Bar / Column Chart', value: 'barChart' },
    { label: 'Line Chart', value: 'lineChart' },
    { label: 'Flat Gauge', value: 'flatGauge' },
    { label: 'Polar Gauge', value: 'polarGauge' },
    { label: 'Ratings Chart', value: 'ratingsChart' },
    { label: 'Pipeline Chart', value: 'pipelineChart' },
    { label: 'Waterfall Chart', value: 'waterfallChart' }
];

const CHART_TYPE_LABEL_MAP = CHART_TYPE_OPTIONS.reduce((map, opt) => {
    map[opt.value] = opt.label;
    return map;
}, {});

const CHART_ICON_MAP = {
    barChart: 'utility:chart',
    lineChart: 'utility:trending',
    flatGauge: 'utility:slider',
    polarGauge: 'utility:target',
    ratingsChart: 'utility:favorite',
    pipelineChart: 'utility:filter',
    waterfallChart: 'utility:waterfall_chart'
};

const ORIENTATION_OPTIONS = [
    { label: 'Vertical', value: 'vertical' },
    { label: 'Horizontal', value: 'horizontal' }
];

const VARIANT_OPTIONS = [
    { label: 'Simple', value: 'simple' },
    { label: 'Stacked', value: 'stacked' },
    { label: 'Grouped', value: 'grouped' }
];

const WATERFALL_MODE_OPTIONS = [
    { label: 'Delta', value: 'delta' },
    { label: 'Cumulative', value: 'cumulative' }
];

const WIDTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
    label: `${i + 1}/12`,
    value: String(i + 1)
}));

const TYPES_WITH_PREFIX = new Set(['barChart', 'lineChart', 'flatGauge', 'pipelineChart', 'waterfallChart']);
const TYPES_WITH_SUFFIX = new Set(['barChart', 'lineChart', 'flatGauge', 'polarGauge', 'pipelineChart', 'waterfallChart']);
const TYPES_WITH_HEIGHT = new Set(['barChart', 'lineChart', 'waterfallChart']);

const DEFAULT_CONFIGS = {
    barChart: {
        chartTitle: '', query: '', labelField: '', valueField: '', seriesField: '',
        orientation: 'vertical', variant: 'simple', valuePrefix: '', valueSuffix: '', height: 300
    },
    lineChart: {
        chartTitle: '', query: '', labelField: '', valueField: '', secondaryValueField: '',
        showArea: true, valuePrefix: '', valueSuffix: '', secondaryPrefix: '', secondarySuffix: '', height: 300
    },
    flatGauge: {
        chartTitle: '', query: '', maxValue: 100, referenceValue: null, referenceLabel: 'Avg',
        valuePrefix: '', valueSuffix: ''
    },
    polarGauge: {
        chartTitle: '', query: '', maxValue: 100, valueSuffix: '%'
    },
    ratingsChart: {
        chartTitle: '', query: '', maxDots: 10
    },
    pipelineChart: {
        chartTitle: '', query: '', valuePrefix: '$', valueSuffix: 'm'
    },
    waterfallChart: {
        chartTitle: '', query: '', mode: 'delta', valuePrefix: '$', valueSuffix: '', height: 300
    }
};

export default class ChartBuddyConfigurator extends LightningElement {
    configId = null;
    configName = '';
    description = '';
    containerTitle = '';
    @track columns = [];
    @track expandedColumns = {};
    contextRecordId = '';
    _wiredConfigsResult;

    // --- Wire ---
    @wire(getConfigs)
    wiredConfigs(result) {
        this._wiredConfigsResult = result;
    }

    // --- Getters: Options ---
    get chartTypeOptions() {
        return CHART_TYPE_OPTIONS;
    }
    get widthOptions() {
        return WIDTH_OPTIONS;
    }
    get orientationOptions() {
        return ORIENTATION_OPTIONS;
    }
    get variantOptions() {
        return VARIANT_OPTIONS;
    }
    get waterfallModeOptions() {
        return WATERFALL_MODE_OPTIONS;
    }

    // --- Getters: Config Select ---
    get configOptions() {
        const configs = this._wiredConfigsResult?.data;
        if (!configs) return [];
        return configs.map(c => ({ label: c.Name, value: c.Id }));
    }

    // --- Getters: Button States ---
    get isSaveDisabled() {
        return !this.configName;
    }
    get isCloneDisabled() {
        return !this.configId;
    }
    get isDeleteDisabled() {
        return !this.configId;
    }
    get isAddColumnDisabled() {
        return this.columns.length >= 12;
    }

    // --- Getters: Column Display ---
    get columnCount() {
        return this.columns.length;
    }
    get hasNoColumns() {
        return this.columns.length === 0;
    }
    get hasColumns() {
        return this.columns.length > 0;
    }

    get renderedColumns() {
        const lastIdx = this.columns.length - 1;
        return this.columns.map((col, idx) => {
            const chartType = col.chartType;
            const isExpanded = this.expandedColumns[col.id] === true;
            const showPrefix = TYPES_WITH_PREFIX.has(chartType);
            const showSuffix = TYPES_WITH_SUFFIX.has(chartType);
            return {
                ...col,
                widthStr: String(col.width),
                columnLabel: `#${idx + 1}`,
                chartTypeLabel: CHART_TYPE_LABEL_MAP[chartType] || chartType,
                widthLabel: `${col.width}/12`,
                iconName: CHART_ICON_MAP[chartType] || 'utility:chart',
                expandIcon: isExpanded ? 'utility:chevrondown' : 'utility:chevronright',
                isExpanded,
                isFirst: idx === 0,
                isLast: idx === lastIdx,
                isBarChart: chartType === 'barChart',
                isLineChart: chartType === 'lineChart',
                isFlatGauge: chartType === 'flatGauge',
                isPolarGauge: chartType === 'polarGauge',
                isRatingsChart: chartType === 'ratingsChart',
                isPipelineChart: chartType === 'pipelineChart',
                isWaterfallChart: chartType === 'waterfallChart',
                showValuePrefix: showPrefix,
                showValueSuffix: showPrefix && showSuffix,
                showValueSuffixOnly: !showPrefix && showSuffix,
                showHeightField: TYPES_WITH_HEIGHT.has(chartType)
            };
        });
    }

    get configJsonPreview() {
        return JSON.stringify(
            { containerTitle: this.containerTitle, columns: this.columns },
            null,
            2
        );
    }

    // --- Config Management Handlers ---
    handleConfigSelect(event) {
        const selectedId = event.detail.value;
        if (!selectedId) {
            this._resetForm();
            return;
        }
        const configs = this._wiredConfigsResult?.data;
        if (!configs) return;
        const selected = configs.find(c => c.Id === selectedId);
        if (!selected) return;
        this.configId = selected.Id;
        this.configName = selected.Name;
        this.description = selected.Description__c || '';
        try {
            const parsed = JSON.parse(selected.Config_JSON__c || '{}');
            this.containerTitle = parsed.containerTitle || '';
            this.columns = (parsed.columns || []).map(c => ({ ...c }));
            this.expandedColumns = {};
        } catch (_err) {
            this.containerTitle = '';
            this.columns = [];
            this.expandedColumns = {};
        }
    }

    handleConfigNameChange(event) {
        this.configName = event.target.value;
    }
    handleDescriptionChange(event) {
        this.description = event.target.value;
    }
    handleContainerTitleChange(event) {
        this.containerTitle = event.target.value;
    }
    handleContextRecordIdChange(event) {
        this.contextRecordId = event.target.value;
    }

    handleNew() {
        this._resetForm();
    }

    async handleSave() {
        if (!this.configName) {
            this._showToast('Error', 'Config Name is required.', 'error');
            return;
        }
        const configJson = JSON.stringify({
            containerTitle: this.containerTitle,
            columns: this.columns
        });
        try {
            const result = await saveConfig({
                configId: this.configId,
                name: this.configName,
                description: this.description,
                configJson
            });
            this.configId = result.Id;
            await refreshApex(this._wiredConfigsResult);
            this._showToast('Success', 'Configuration saved.', 'success');
        } catch (error) {
            this._showToast('Error', this._reduceErrors(error), 'error');
        }
    }

    handleClone() {
        this.configId = null;
        this.configName = this.configName + ' (Copy)';
        this._showToast('Info', 'Cloned. Make changes and click Save to create a new config.', 'info');
    }

    async handleDelete() {
        if (!this.configId) return;
        try {
            await deleteConfig({ configId: this.configId });
            await refreshApex(this._wiredConfigsResult);
            this._resetForm();
            this._showToast('Success', 'Configuration deleted.', 'success');
        } catch (error) {
            this._showToast('Error', this._reduceErrors(error), 'error');
        }
    }

    // --- Column Handlers ---
    handleAddColumn() {
        if (this.columns.length >= 12) return;
        const id = 'col-' + Date.now();
        const defaultConfig = { ...DEFAULT_CONFIGS.barChart };
        this.columns = [
            ...this.columns,
            { id, chartType: 'barChart', width: 6, config: defaultConfig }
        ];
        this.expandedColumns = { ...this.expandedColumns, [id]: true };
    }

    handleRemoveColumn(event) {
        const colId = event.currentTarget.dataset.id;
        this.columns = this.columns.filter(c => c.id !== colId);
        const updated = { ...this.expandedColumns };
        delete updated[colId];
        this.expandedColumns = updated;
    }

    handleToggleExpand(event) {
        const colId = event.currentTarget.dataset.id;
        this.expandedColumns = {
            ...this.expandedColumns,
            [colId]: !this.expandedColumns[colId]
        };
    }

    handleMoveUp(event) {
        const colId = event.currentTarget.dataset.id;
        const idx = this.columns.findIndex(c => c.id === colId);
        if (idx <= 0) return;
        const updated = [...this.columns];
        [updated[idx - 1], updated[idx]] = [updated[idx], updated[idx - 1]];
        this.columns = updated;
    }

    handleMoveDown(event) {
        const colId = event.currentTarget.dataset.id;
        const idx = this.columns.findIndex(c => c.id === colId);
        if (idx < 0 || idx >= this.columns.length - 1) return;
        const updated = [...this.columns];
        [updated[idx], updated[idx + 1]] = [updated[idx + 1], updated[idx]];
        this.columns = updated;
    }

    handleColumnTopLevelChange(event) {
        const colId = event.currentTarget.dataset.id;
        const field = event.currentTarget.dataset.field;
        const value = event.detail.value;
        this.columns = this.columns.map(c => {
            if (c.id !== colId) return c;
            if (field === 'chartType') {
                const newConfig = { ...DEFAULT_CONFIGS[value], chartTitle: c.config.chartTitle, query: c.config.query };
                return { ...c, chartType: value, config: newConfig };
            }
            if (field === 'width') {
                return { ...c, width: parseInt(value, 10) };
            }
            return c;
        });
    }

    handleColumnConfigChange(event) {
        const colId = event.currentTarget.dataset.id;
        const field = event.currentTarget.dataset.field;
        const value = event.detail?.value !== undefined ? event.detail.value : event.target.value;
        this.columns = this.columns.map(c => {
            if (c.id !== colId) return c;
            const updatedConfig = { ...c.config, [field]: value };
            if (field === 'query' && event.detail) {
                if (event.detail.labelField !== undefined) updatedConfig.labelField = event.detail.labelField;
                if (event.detail.valueField !== undefined) updatedConfig.valueField = event.detail.valueField;
                if (event.detail.seriesField !== undefined) updatedConfig.seriesField = event.detail.seriesField;
                if (event.detail.secondaryValueField !== undefined) updatedConfig.secondaryValueField = event.detail.secondaryValueField;
            }
            return { ...c, config: updatedConfig };
        });
    }

    handleColumnCheckboxChange(event) {
        const colId = event.currentTarget.dataset.id;
        const field = event.currentTarget.dataset.field;
        const value = event.target.checked;
        this.columns = this.columns.map(c => {
            if (c.id !== colId) return c;
            return { ...c, config: { ...c.config, [field]: value } };
        });
    }

    // --- Private Helpers ---
    _resetForm() {
        this.configId = null;
        this.configName = '';
        this.description = '';
        this.containerTitle = '';
        this.columns = [];
        this.expandedColumns = {};
    }

    _showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }

    _reduceErrors(error) {
        if (typeof error === 'string') return error;
        if (error?.body?.message) return error.body.message;
        if (error?.message) return error.message;
        if (Array.isArray(error?.body)) {
            return error.body.map(e => e.message).join(', ');
        }
        return 'An unknown error occurred.';
    }
}
