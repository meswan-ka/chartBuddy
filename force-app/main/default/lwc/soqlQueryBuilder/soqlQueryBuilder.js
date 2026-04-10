import { LightningElement, api, track } from 'lwc';
import findObjects from '@salesforce/apex/SoqlBuilderController.findObjects';
import describeFields from '@salesforce/apex/SoqlBuilderController.describeFields';
import { parseSoql, buildSoql } from './soqlParser';

const AGGREGATE_OPTIONS = [
    { label: 'SUM', value: 'SUM' },
    { label: 'COUNT', value: 'COUNT' },
    { label: 'AVG', value: 'AVG' },
    { label: 'MIN', value: 'MIN' },
    { label: 'MAX', value: 'MAX' }
];

const OPERATOR_OPTIONS = [
    { label: '=', value: '=' },
    { label: '!=', value: '!=' },
    { label: '>', value: '>' },
    { label: '<', value: '<' },
    { label: '>=', value: '>=' },
    { label: '<=', value: '<=' },
    { label: 'LIKE', value: 'LIKE' },
    { label: 'IN', value: 'IN' },
    { label: 'NOT IN', value: 'NOT IN' }
];

const DIRECTION_OPTIONS = [
    { label: 'ASC', value: 'ASC' },
    { label: 'DESC', value: 'DESC' }
];

const BUILDER_PROFILES = {
    barChart: {
        slots: [
            { key: 'label', label: 'Label', requireAggregate: false, required: true },
            { key: 'value', label: 'Value', requireAggregate: true, required: true },
            { key: 'series', label: 'Series', requireAggregate: false, required: false }
        ],
        autoGroupBy: true,
        showOrderBy: true,
        showLimit: true
    },
    lineChart: {
        slots: [
            { key: 'label', label: 'Label', requireAggregate: false, required: true },
            { key: 'value', label: 'Value', requireAggregate: true, required: true },
            { key: 'secondaryValue', label: 'Secondary Value', requireAggregate: true, required: false }
        ],
        autoGroupBy: true,
        showOrderBy: true,
        showLimit: true
    },
    flatGauge: {
        slots: [
            { key: 'value', label: 'Value', requireAggregate: true, required: true }
        ],
        autoGroupBy: false,
        showOrderBy: false,
        showLimit: false
    },
    polarGauge: {
        slots: [
            { key: 'value', label: 'Value', requireAggregate: true, required: true }
        ],
        autoGroupBy: false,
        showOrderBy: false,
        showLimit: false
    },
    ratingsChart: {
        slots: [
            { key: 'value', label: 'Value', requireAggregate: true, required: true }
        ],
        autoGroupBy: false,
        showOrderBy: false,
        showLimit: false
    },
    pipelineChart: {
        slots: [
            { key: 'label', label: 'Label', requireAggregate: false, required: true },
            { key: 'value', label: 'Value', requireAggregate: true, required: true }
        ],
        autoGroupBy: true,
        showOrderBy: false,
        showLimit: true
    },
    waterfallChart: {
        slots: [
            { key: 'label', label: 'Label', requireAggregate: false, required: true },
            { key: 'value', label: 'Value', requireAggregate: true, required: true }
        ],
        autoGroupBy: true,
        showOrderBy: false,
        showLimit: true
    }
};

export default class SoqlQueryBuilder extends LightningElement {
    // --- API ---
    _chartType = 'barChart';
    _query = '';
    _initialParseComplete = false;

    @api
    get chartType() {
        return this._chartType;
    }
    set chartType(value) {
        const prev = this._chartType;
        this._chartType = value || 'barChart';
        if (prev && prev !== this._chartType && this._initialParseComplete) {
            this._resetSlotsForProfile();
        }
    }

    @api
    get query() {
        return this._query;
    }
    set query(value) {
        this._query = value || '';
        if (!this._initialParseComplete) {
            this._parseInitialQuery();
        }
    }

    // --- Internal State ---
    isRawMode = false;
    rawQuery = '';
    objectName = '';
    objectSearchTerm = '';
    @track objectSearchResults = [];
    showObjectDropdown = false;
    @track fieldOptions = [];
    @track fields = [];
    recordContextField = '';
    @track whereConditions = [];
    orderByField = '';
    orderByDirection = 'ASC';
    queryLimit = '';
    @track customFieldFlags = {};
    _searchTimeout = null;
    _rawChangeTimeout = null;
    _describeCounter = 0;

    // Warning modal state
    showWarningModal = false;
    @track warningMessages = [];
    _pendingParseState = null;

    // --- Lifecycle ---
    connectedCallback() {
        if (!this._initialParseComplete && this._query) {
            this._parseInitialQuery();
        } else if (!this._initialParseComplete) {
            this._initEmptySlots();
            this._initialParseComplete = true;
        }
    }

    // --- Getters ---
    get profile() {
        return BUILDER_PROFILES[this._chartType] || BUILDER_PROFILES.barChart;
    }

    get aggregateOptions() {
        return AGGREGATE_OPTIONS;
    }

    get operatorOptions() {
        return OPERATOR_OPTIONS;
    }

    get directionOptions() {
        return DIRECTION_OPTIONS;
    }

    get showOrderBy() {
        return this.profile.showOrderBy;
    }

    get showLimit() {
        return this.profile.showLimit;
    }

    get renderedSlots() {
        const profile = this.profile;
        return profile.slots.map((slot, idx) => {
            const field = this.fields[idx] || { fieldName: '', aggregate: '', alias: '' };
            return {
                key: slot.key,
                label: slot.label,
                requireAggregate: slot.requireAggregate,
                required: slot.required,
                index: idx,
                fieldName: field.fieldName || '',
                aggregate: field.aggregate || '',
                alias: field.alias || '',
                showCustomInput: this.customFieldFlags[slot.key] === true,
                requiredLabel: slot.required ? '*' : '(optional)'
            };
        });
    }

    get renderedWhereConditions() {
        return this.whereConditions.map((cond, idx) => ({
            ...cond,
            index: idx,
            id: 'where-' + idx
        }));
    }

    get hasWhereConditions() {
        return this.whereConditions.length > 0;
    }

    get recordContextOptions() {
        const opts = [{ label: '-- None --', value: '' }];
        const refFields = [];
        const otherFields = [];
        for (const f of this.fieldOptions) {
            if (f.fieldType === 'REFERENCE' || f.fieldType === 'ID') {
                refFields.push({ label: f.label + ' (' + f.apiName + ')', value: f.apiName });
            } else {
                otherFields.push({ label: f.label + ' (' + f.apiName + ')', value: f.apiName });
            }
        }
        return opts.concat(refFields, otherFields);
    }

    get fieldPickerOptions() {
        return this.fieldOptions.map(f => ({
            label: f.label + ' (' + f.apiName + ')',
            value: f.apiName
        }));
    }

    get soqlPreview() {
        if (this.isRawMode) {
            return this.rawQuery || '';
        }
        const state = this._buildState();
        const soql = buildSoql(state, this.profile);
        return soql || '';
    }

    get builderModeVariant() {
        return this.isRawMode ? 'neutral' : 'brand';
    }

    get rawModeVariant() {
        return this.isRawMode ? 'brand' : 'neutral';
    }

    // --- Object Search ---
    handleObjectSearchInput(event) {
        const term = event.target.value;
        this.objectSearchTerm = term;
        if (this._searchTimeout) {
            clearTimeout(this._searchTimeout);
        }
        if (!term || term.length < 2) {
            this.objectSearchResults = [];
            this.showObjectDropdown = false;
            return;
        }
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        this._searchTimeout = setTimeout(() => {
            this._searchObjects(term);
        }, 300);
    }

    async _searchObjects(term) {
        try {
            const results = await findObjects({ searchTerm: term });
            this.objectSearchResults = results.map(r => ({
                ...r,
                displayLabel: r.label + ' (' + r.apiName + ')'
            }));
            this.showObjectDropdown = this.objectSearchResults.length > 0;
        } catch (err) {
            this.objectSearchResults = [];
            this.showObjectDropdown = false;
        }
    }

    handleObjectSelect(event) {
        const apiName = event.currentTarget.dataset.apiname;
        const selected = this.objectSearchResults.find(r => r.apiName === apiName);
        if (!selected) return;
        this.objectName = selected.apiName;
        this.objectSearchTerm = selected.displayLabel;
        this.showObjectDropdown = false;
        this._clearFieldSelections();
        this._loadFields(selected.apiName);
    }

    handleObjectSearchBlur() {
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        setTimeout(() => {
            this.showObjectDropdown = false;
        }, 200);
    }

    async _loadFields(objectName) {
        this._describeCounter++;
        const requestId = this._describeCounter;
        try {
            const results = await describeFields({ objectName });
            if (requestId !== this._describeCounter) return;
            this.fieldOptions = results;
        } catch (err) {
            if (requestId === this._describeCounter) {
                this.fieldOptions = [];
            }
        }
    }

    _clearFieldSelections() {
        this._initEmptySlots();
        this.recordContextField = '';
        this.whereConditions = [];
        this.orderByField = '';
        this.queryLimit = '';
        this._fireQueryChange();
    }

    // --- Field Slot Handlers ---
    handleFieldChange(event) {
        const idx = parseInt(event.currentTarget.dataset.index, 10);
        const value = event.detail.value;
        const updatedFields = [...this.fields];
        updatedFields[idx] = {
            ...updatedFields[idx],
            fieldName: value,
            alias: updatedFields[idx].aggregate ? this._generateAlias(value, idx) : null
        };
        this.fields = updatedFields;
        this._fireQueryChange();
    }

    handleAggregateChange(event) {
        const idx = parseInt(event.currentTarget.dataset.index, 10);
        const value = event.detail.value;
        const updatedFields = [...this.fields];
        updatedFields[idx] = {
            ...updatedFields[idx],
            aggregate: value,
            alias: this._generateAlias(updatedFields[idx].fieldName, idx)
        };
        this.fields = updatedFields;
        this._fireQueryChange();
    }

    handleCustomFieldToggle(event) {
        const key = event.currentTarget.dataset.key;
        this.customFieldFlags = {
            ...this.customFieldFlags,
            [key]: !this.customFieldFlags[key]
        };
    }

    handleCustomFieldInput(event) {
        const idx = parseInt(event.currentTarget.dataset.index, 10);
        const value = event.target.value;
        const updatedFields = [...this.fields];
        updatedFields[idx] = {
            ...updatedFields[idx],
            fieldName: value,
            alias: updatedFields[idx].aggregate ? this._generateAlias(value, idx) : null
        };
        this.fields = updatedFields;
        this._fireQueryChange();
    }

    // --- Record Context ---
    handleRecordContextChange(event) {
        this.recordContextField = event.detail.value;
        this._fireQueryChange();
    }

    // --- WHERE Handlers ---
    handleAddWhereCondition() {
        this.whereConditions = [
            ...this.whereConditions,
            { fieldName: '', operator: '=', value: '' }
        ];
    }

    handleWhereFieldChange(event) {
        const idx = parseInt(event.currentTarget.dataset.index, 10);
        const updated = [...this.whereConditions];
        updated[idx] = { ...updated[idx], fieldName: event.detail.value };
        this.whereConditions = updated;
        this._fireQueryChange();
    }

    handleWhereOperatorChange(event) {
        const idx = parseInt(event.currentTarget.dataset.index, 10);
        const updated = [...this.whereConditions];
        updated[idx] = { ...updated[idx], operator: event.detail.value };
        this.whereConditions = updated;
        this._fireQueryChange();
    }

    handleWhereValueChange(event) {
        const idx = parseInt(event.currentTarget.dataset.index, 10);
        const updated = [...this.whereConditions];
        updated[idx] = { ...updated[idx], value: event.target.value };
        this.whereConditions = updated;
        this._fireQueryChange();
    }

    handleRemoveWhereCondition(event) {
        const idx = parseInt(event.currentTarget.dataset.index, 10);
        this.whereConditions = this.whereConditions.filter((_, i) => i !== idx);
        this._fireQueryChange();
    }

    // --- ORDER BY / LIMIT ---
    handleOrderByFieldChange(event) {
        this.orderByField = event.detail.value;
        this._fireQueryChange();
    }

    handleOrderByDirectionChange(event) {
        this.orderByDirection = event.detail.value;
        this._fireQueryChange();
    }

    handleLimitChange(event) {
        this.queryLimit = event.target.value;
        this._fireQueryChange();
    }

    // --- Mode Toggle ---
    handleBuilderMode() {
        if (!this.isRawMode) return;
        const result = parseSoql(this.rawQuery);
        if (result.success) {
            this._applyParseState(result.state);
            this.isRawMode = false;
            if (result.state.objectName) {
                this._loadFields(result.state.objectName);
            }
            this._fireQueryChange();
        } else {
            this.warningMessages = result.warnings;
            this._pendingParseState = result.state;
            this.showWarningModal = true;
        }
    }

    handleRawMode() {
        if (this.isRawMode) return;
        const state = this._buildState();
        this.rawQuery = buildSoql(state, this.profile) || '';
        this.isRawMode = true;
    }

    handleRawQueryChange(event) {
        this.rawQuery = event.target.value;
        if (this._rawChangeTimeout) {
            clearTimeout(this._rawChangeTimeout);
        }
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        this._rawChangeTimeout = setTimeout(() => {
            this._fireQueryChange();
        }, 300);
    }

    // --- Warning Modal ---
    handleWarningSwitch() {
        if (this._pendingParseState) {
            this._applyParseState(this._pendingParseState);
            if (this._pendingParseState.objectName) {
                this._loadFields(this._pendingParseState.objectName);
            }
        }
        this.isRawMode = false;
        this.showWarningModal = false;
        this._pendingParseState = null;
        this._fireQueryChange();
    }

    handleWarningStay() {
        this.showWarningModal = false;
        this._pendingParseState = null;
    }

    // --- Private Methods ---
    _initEmptySlots() {
        const profile = this.profile;
        this.fields = profile.slots.map(() => ({
            fieldName: '',
            aggregate: '',
            alias: ''
        }));
    }

    _resetSlotsForProfile() {
        this._initEmptySlots();
        if (!this.profile.showOrderBy) {
            this.orderByField = '';
            this.orderByDirection = 'ASC';
        }
        if (!this.profile.showLimit) {
            this.queryLimit = '';
        }
        this._fireQueryChange();
    }

    _parseInitialQuery() {
        if (!this._query) {
            this._initEmptySlots();
            this._initialParseComplete = true;
            return;
        }
        const result = parseSoql(this._query);
        if (result.success) {
            this._applyParseState(result.state);
        } else {
            this.rawQuery = this._query;
            this.isRawMode = true;
        }
        this._initialParseComplete = true;

        if (result.state.objectName) {
            this._loadFields(result.state.objectName);
        }
    }

    _applyParseState(state) {
        this.objectName = state.objectName || '';
        this.objectSearchTerm = state.objectName || '';
        this.recordContextField = state.recordContextField || '';
        this.orderByField = state.orderByField || '';
        this.orderByDirection = state.orderByDirection || 'ASC';
        this.queryLimit = state.queryLimit != null ? String(state.queryLimit) : '';

        const profile = this.profile;
        const parsedFields = state.fields || [];
        this.fields = profile.slots.map((slot, idx) => {
            const parsed = parsedFields[idx];
            if (!parsed) {
                return { fieldName: '', aggregate: '', alias: '' };
            }
            return {
                fieldName: parsed.fieldName || '',
                aggregate: parsed.aggregate || '',
                alias: parsed.alias || ''
            };
        });

        this.whereConditions = (state.whereConditions || []).map(c => ({ ...c }));
    }

    _buildState() {
        return {
            objectName: this.objectName,
            fields: this.fields.map(f => ({ ...f })),
            recordContextField: this.recordContextField,
            whereConditions: this.whereConditions.map(c => ({ ...c })),
            orderByField: this.orderByField,
            orderByDirection: this.orderByDirection,
            queryLimit: this.queryLimit ? parseInt(this.queryLimit, 10) : null
        };
    }

    _generateAlias(fieldName, excludeIndex) {
        if (!fieldName) return '';
        const existingAliases = new Set();
        this.fields.forEach((f, i) => {
            if (i !== excludeIndex && f.alias) {
                existingAliases.add(f.alias);
            }
        });
        const segments = fieldName.split('.');
        let base = segments[segments.length - 1].toLowerCase();
        let alias = base;
        let counter = 2;
        while (existingAliases.has(alias)) {
            alias = base + counter;
            counter++;
        }
        return alias;
    }

    _fireQueryChange() {
        let soqlValue = '';
        const detail = {
            value: '',
            labelField: null,
            valueField: null,
            seriesField: null,
            secondaryValueField: null
        };

        if (this.isRawMode) {
            soqlValue = this.rawQuery;
        } else {
            const state = this._buildState();
            soqlValue = buildSoql(state, this.profile) || '';
        }
        detail.value = soqlValue;

        if (!this.isRawMode) {
            const profile = this.profile;
            for (let i = 0; i < profile.slots.length; i++) {
                const slot = profile.slots[i];
                const field = this.fields[i];
                if (!field || !field.fieldName) continue;
                if (slot.key === 'label') {
                    detail.labelField = field.fieldName;
                } else if (slot.key === 'value') {
                    detail.valueField = field.alias || field.fieldName;
                } else if (slot.key === 'series') {
                    detail.seriesField = field.fieldName;
                } else if (slot.key === 'secondaryValue') {
                    detail.secondaryValueField = field.alias || field.fieldName;
                }
            }
        }

        this.dispatchEvent(new CustomEvent('querychange', {
            detail,
            bubbles: false,
            composed: false
        }));
    }
}
