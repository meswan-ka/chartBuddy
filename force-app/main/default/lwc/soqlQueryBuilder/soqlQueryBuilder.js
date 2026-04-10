import { LightningElement, api, track } from 'lwc';
import findObjects from '@salesforce/apex/SoqlBuilderController.findObjects';
import describeFields from '@salesforce/apex/SoqlBuilderController.describeFields';
import { parseSoql, buildSoql } from './soqlParser';

const AGGREGATE_OPTIONS = [
    { label: '-- None --', value: '' },
    { label: 'SUM', value: 'SUM' },
    { label: 'COUNT', value: 'COUNT' },
    { label: 'AVG', value: 'AVG' },
    { label: 'MIN', value: 'MIN' },
    { label: 'MAX', value: 'MAX' }
];

const OPERATOR_OPTIONS = [
    { label: 'Equals', value: '=' },
    { label: 'Does Not Equal', value: '!=' },
    { label: 'Less Than', value: '<' },
    { label: 'Less Than Or Equal To', value: '<=' },
    { label: 'Greater Than', value: '>' },
    { label: 'Greater Than Or Equal To', value: '>=' },
    { label: 'Contains', value: 'CONTAINS' },
    { label: 'Does Not Contain', value: 'NOT_CONTAINS' },
    { label: 'Starts With', value: 'STARTS_WITH' },
    { label: 'Does Not Start With', value: 'NOT_STARTS_WITH' },
    { label: 'Ends With', value: 'ENDS_WITH' },
    { label: 'Does Not End With', value: 'NOT_ENDS_WITH' },
    { label: 'Is Null', value: 'IS_NULL' },
    { label: 'Is Not Null', value: 'IS_NOT_NULL' },
    { label: 'In', value: 'IN' },
    { label: 'Not In', value: 'NOT IN' },
    { label: 'Includes', value: 'INCLUDES' },
    { label: 'Excludes', value: 'EXCLUDES' }
];

// Operators that don't need a value input
const NO_VALUE_OPERATORS = new Set(['IS_NULL', 'IS_NOT_NULL']);

const DIRECTION_OPTIONS = [
    { label: 'Ascending', value: 'ASC' },
    { label: 'Descending', value: 'DESC' }
];

const VALUE_TYPE_OPTIONS = [
    { label: 'Literal', value: 'literal' },
    { label: 'Date/Time', value: 'date' }
];

const DATE_LITERAL_OPTIONS = [
    { label: 'TODAY', value: 'TODAY' },
    { label: 'YESTERDAY', value: 'YESTERDAY' },
    { label: 'TOMORROW', value: 'TOMORROW' },
    { label: 'THIS_WEEK', value: 'THIS_WEEK' },
    { label: 'LAST_WEEK', value: 'LAST_WEEK' },
    { label: 'NEXT_WEEK', value: 'NEXT_WEEK' },
    { label: 'THIS_MONTH', value: 'THIS_MONTH' },
    { label: 'LAST_MONTH', value: 'LAST_MONTH' },
    { label: 'NEXT_MONTH', value: 'NEXT_MONTH' },
    { label: 'THIS_QUARTER', value: 'THIS_QUARTER' },
    { label: 'LAST_QUARTER', value: 'LAST_QUARTER' },
    { label: 'NEXT_QUARTER', value: 'NEXT_QUARTER' },
    { label: 'THIS_YEAR', value: 'THIS_YEAR' },
    { label: 'LAST_YEAR', value: 'LAST_YEAR' },
    { label: 'NEXT_YEAR', value: 'NEXT_YEAR' },
    { label: 'THIS_FISCAL_QUARTER', value: 'THIS_FISCAL_QUARTER' },
    { label: 'LAST_FISCAL_QUARTER', value: 'LAST_FISCAL_QUARTER' },
    { label: 'NEXT_FISCAL_QUARTER', value: 'NEXT_FISCAL_QUARTER' },
    { label: 'THIS_FISCAL_YEAR', value: 'THIS_FISCAL_YEAR' },
    { label: 'LAST_FISCAL_YEAR', value: 'LAST_FISCAL_YEAR' },
    { label: 'NEXT_FISCAL_YEAR', value: 'NEXT_FISCAL_YEAR' },
    { label: 'LAST_N_DAYS:n', value: 'LAST_N_DAYS:' },
    { label: 'NEXT_N_DAYS:n', value: 'NEXT_N_DAYS:' },
    { label: 'LAST_N_WEEKS:n', value: 'LAST_N_WEEKS:' },
    { label: 'NEXT_N_WEEKS:n', value: 'NEXT_N_WEEKS:' },
    { label: 'LAST_N_MONTHS:n', value: 'LAST_N_MONTHS:' },
    { label: 'NEXT_N_MONTHS:n', value: 'NEXT_N_MONTHS:' },
    { label: 'LAST_N_QUARTERS:n', value: 'LAST_N_QUARTERS:' },
    { label: 'NEXT_N_QUARTERS:n', value: 'NEXT_N_QUARTERS:' },
    { label: 'LAST_N_YEARS:n', value: 'LAST_N_YEARS:' },
    { label: 'NEXT_N_YEARS:n', value: 'NEXT_N_YEARS:' },
    { label: 'LAST_N_FISCAL_QUARTERS:n', value: 'LAST_N_FISCAL_QUARTERS:' },
    { label: 'NEXT_N_FISCAL_QUARTERS:n', value: 'NEXT_N_FISCAL_QUARTERS:' },
    { label: 'LAST_N_FISCAL_YEARS:n', value: 'LAST_N_FISCAL_YEARS:' },
    { label: 'NEXT_N_FISCAL_YEARS:n', value: 'NEXT_N_FISCAL_YEARS:' }
];

// Date literals that are simple keywords (no :n parameter)
const SIMPLE_DATE_LITERALS = new Set([
    'TODAY', 'YESTERDAY', 'TOMORROW',
    'THIS_WEEK', 'LAST_WEEK', 'NEXT_WEEK',
    'THIS_MONTH', 'LAST_MONTH', 'NEXT_MONTH',
    'THIS_QUARTER', 'LAST_QUARTER', 'NEXT_QUARTER',
    'THIS_YEAR', 'LAST_YEAR', 'NEXT_YEAR',
    'THIS_FISCAL_QUARTER', 'LAST_FISCAL_QUARTER', 'NEXT_FISCAL_QUARTER',
    'THIS_FISCAL_YEAR', 'LAST_FISCAL_YEAR', 'NEXT_FISCAL_YEAR'
]);

// All known date literal prefixes (for auto-detecting type from parsed values)
const DATE_LITERAL_PREFIXES = [
    'TODAY', 'YESTERDAY', 'TOMORROW',
    'THIS_WEEK', 'LAST_WEEK', 'NEXT_WEEK',
    'THIS_MONTH', 'LAST_MONTH', 'NEXT_MONTH',
    'THIS_QUARTER', 'LAST_QUARTER', 'NEXT_QUARTER',
    'THIS_YEAR', 'LAST_YEAR', 'NEXT_YEAR',
    'THIS_FISCAL_QUARTER', 'LAST_FISCAL_QUARTER', 'NEXT_FISCAL_QUARTER',
    'THIS_FISCAL_YEAR', 'LAST_FISCAL_YEAR', 'NEXT_FISCAL_YEAR',
    'LAST_N_DAYS:', 'NEXT_N_DAYS:',
    'LAST_N_WEEKS:', 'NEXT_N_WEEKS:',
    'LAST_N_MONTHS:', 'NEXT_N_MONTHS:',
    'LAST_N_QUARTERS:', 'NEXT_N_QUARTERS:',
    'LAST_N_YEARS:', 'NEXT_N_YEARS:',
    'LAST_N_FISCAL_QUARTERS:', 'NEXT_N_FISCAL_QUARTERS:',
    'LAST_N_FISCAL_YEARS:', 'NEXT_N_FISCAL_YEARS:'
];

function isDateLiteral(value) {
    if (!value) return false;
    const upper = value.toUpperCase().trim();
    return DATE_LITERAL_PREFIXES.some(p => upper === p || upper.startsWith(p));
}

/**
 * Chart profiles control the field-editing mode and clause visibility.
 * mode: 'dynamic' = free-form add/remove fields (multi-field charts)
 * mode: 'single'  = exactly one aggregate value field (gauges)
 */
const BUILDER_PROFILES = {
    barChart: {
        mode: 'dynamic',
        autoGroupBy: true,
        showOrderBy: true,
        showLimit: true
    },
    lineChart: {
        mode: 'dynamic',
        autoGroupBy: true,
        showOrderBy: true,
        showLimit: true
    },
    flatGauge: {
        mode: 'single',
        autoGroupBy: false,
        showOrderBy: false,
        showLimit: false
    },
    polarGauge: {
        mode: 'single',
        autoGroupBy: false,
        showOrderBy: false,
        showLimit: false
    },
    ratingsChart: {
        mode: 'single',
        autoGroupBy: false,
        showOrderBy: false,
        showLimit: false
    },
    pipelineChart: {
        mode: 'dynamic',
        autoGroupBy: true,
        showOrderBy: false,
        showLimit: true
    },
    waterfallChart: {
        mode: 'dynamic',
        autoGroupBy: true,
        showOrderBy: false,
        showLimit: true
    }
};

let _fieldIdCounter = 0;
function nextFieldId() {
    _fieldIdCounter++;
    return 'fld-' + _fieldIdCounter;
}

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
            this._resetFieldsForProfile();
        }
    }

    @api
    get query() {
        return this._query;
    }
    set query(value) {
        const newQuery = value || '';
        if (newQuery === this._query) return;
        this._query = newQuery;
        if (this._initialParseComplete) {
            if (this._query) {
                const result = parseSoql(this._query);
                if (result.success) {
                    this._applyParseState(result.state);
                    this.isRawMode = false;
                    if (result.state.objectName) {
                        this._loadFields(result.state.objectName);
                    }
                } else {
                    this.rawQuery = this._query;
                    this.isRawMode = true;
                }
            } else {
                this._initEmptyFields();
            }
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

    showWarningModal = false;
    @track warningMessages = [];
    _pendingParseState = null;

    // --- Lifecycle ---
    connectedCallback() {
        if (!this._initialParseComplete && this._query) {
            this._parseInitialQuery();
        } else if (!this._initialParseComplete) {
            this._initEmptyFields();
            this._initialParseComplete = true;
        }
    }

    // --- Getters ---
    get profile() {
        return BUILDER_PROFILES[this._chartType] || BUILDER_PROFILES.barChart;
    }

    get isDynamicMode() {
        return this.profile.mode === 'dynamic';
    }

    get isSingleMode() {
        return this.profile.mode === 'single';
    }

    get aggregateOptions() {
        return AGGREGATE_OPTIONS;
    }

    get aggregateOptionsRequired() {
        // For single-mode gauges, no "None" option
        return AGGREGATE_OPTIONS.filter(o => o.value !== '');
    }

    get operatorOptions() {
        return OPERATOR_OPTIONS;
    }

    get directionOptions() {
        return DIRECTION_OPTIONS;
    }

    get valueTypeOptions() {
        return VALUE_TYPE_OPTIONS;
    }

    get dateLiteralOptions() {
        return DATE_LITERAL_OPTIONS;
    }

    get showOrderBy() {
        return this.profile.showOrderBy;
    }

    get showLimit() {
        return this.profile.showLimit;
    }

    get showLimitOnly() {
        return this.profile.showLimit && !this.profile.showOrderBy;
    }

    get renderedFields() {
        return this.fields.map((field, idx) => ({
            ...field,
            index: idx,
            showCustomInput: this.customFieldFlags[field.id] === true,
            isRemovable: this.fields.length > 1,
            roleLabel: this._getFieldRoleLabel(field, idx)
        }));
    }

    get singleField() {
        const field = this.fields[0] || { id: 'single', fieldName: '', aggregate: '', alias: '' };
        return {
            ...field,
            index: 0,
            showCustomInput: this.customFieldFlags[field.id] === true
        };
    }

    get renderedWhereConditions() {
        return this.whereConditions.map((cond, idx) => {
            const vt = cond.valueType || 'literal';
            const isDate = vt === 'date';
            // For N-type date literals (e.g. LAST_N_DAYS:30), split into base + n
            let dateLiteralBase = '';
            let dateLiteralN = '';
            let needsN = false;
            if (isDate && cond.value) {
                const colonIdx = cond.value.indexOf(':');
                if (colonIdx > -1) {
                    dateLiteralBase = cond.value.substring(0, colonIdx + 1);
                    dateLiteralN = cond.value.substring(colonIdx + 1);
                    needsN = true;
                } else {
                    dateLiteralBase = cond.value;
                    needsN = !SIMPLE_DATE_LITERALS.has(cond.value.toUpperCase());
                }
            }
            return {
                ...cond,
                index: idx,
                id: 'where-' + idx,
                valueType: vt,
                isDateValue: isDate,
                isLiteralValue: !isDate,
                dateLiteralBase,
                dateLiteralN,
                needsN,
                needsValue: !NO_VALUE_OPERATORS.has(cond.operator)
            };
        });
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
        this._initEmptyFields();
        this.recordContextField = '';
        this.whereConditions = [];
        this.orderByField = '';
        this.queryLimit = '';
        this._fireQueryChange();
    }

    // --- Dynamic Field Handlers ---
    handleAddField() {
        this.fields = [
            ...this.fields,
            { id: nextFieldId(), fieldName: '', aggregate: '', alias: '' }
        ];
    }

    handleRemoveField(event) {
        const idx = parseInt(event.currentTarget.dataset.index, 10);
        if (this.fields.length <= 1) return;
        this.fields = this.fields.filter((_, i) => i !== idx);
        this._fireQueryChange();
    }

    handleFieldChange(event) {
        const idx = parseInt(event.currentTarget.dataset.index, 10);
        const value = event.detail.value;
        const updatedFields = [...this.fields];
        updatedFields[idx] = {
            ...updatedFields[idx],
            fieldName: value,
            alias: updatedFields[idx].aggregate ? this._generateAlias(value, idx) : ''
        };
        this.fields = updatedFields;
        this._fireQueryChange();
    }

    handleAggregateChange(event) {
        const idx = parseInt(event.currentTarget.dataset.index, 10);
        const value = event.detail.value;
        const updatedFields = [...this.fields];
        const fieldName = updatedFields[idx].fieldName;
        updatedFields[idx] = {
            ...updatedFields[idx],
            aggregate: value,
            alias: value ? this._generateAlias(fieldName, idx) : ''
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
            alias: updatedFields[idx].aggregate ? this._generateAlias(value, idx) : ''
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
            { fieldName: '', operator: '=', value: '', valueType: 'literal' }
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
        const newOp = event.detail.value;
        const updated = [...this.whereConditions];
        const patch = { ...updated[idx], operator: newOp };
        // Clear value when switching to null operators
        if (NO_VALUE_OPERATORS.has(newOp)) {
            patch.value = '';
        }
        updated[idx] = patch;
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

    handleWhereValueTypeChange(event) {
        const idx = parseInt(event.currentTarget.dataset.index, 10);
        const updated = [...this.whereConditions];
        updated[idx] = { ...updated[idx], valueType: event.detail.value, value: '' };
        this.whereConditions = updated;
        this._fireQueryChange();
    }

    handleWhereDateLiteralChange(event) {
        const idx = parseInt(event.currentTarget.dataset.index, 10);
        const literal = event.detail.value;
        const updated = [...this.whereConditions];
        // For N-type literals (ending with :), keep existing N value
        if (literal.endsWith(':')) {
            const existing = updated[idx].value || '';
            const colonIdx = existing.indexOf(':');
            const n = colonIdx > -1 ? existing.substring(colonIdx + 1) : '';
            updated[idx] = { ...updated[idx], value: literal + n };
        } else {
            updated[idx] = { ...updated[idx], value: literal };
        }
        this.whereConditions = updated;
        this._fireQueryChange();
    }

    handleWhereDateNChange(event) {
        const idx = parseInt(event.currentTarget.dataset.index, 10);
        const n = event.target.value;
        const updated = [...this.whereConditions];
        const existing = updated[idx].value || '';
        const colonIdx = existing.indexOf(':');
        const base = colonIdx > -1 ? existing.substring(0, colonIdx + 1) : existing;
        updated[idx] = { ...updated[idx], value: base + n };
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
    _initEmptyFields() {
        if (this.isSingleMode) {
            this.fields = [{ id: nextFieldId(), fieldName: '', aggregate: 'SUM', alias: '' }];
        } else {
            this.fields = [
                { id: nextFieldId(), fieldName: '', aggregate: '', alias: '' },
                { id: nextFieldId(), fieldName: '', aggregate: 'SUM', alias: '' }
            ];
        }
    }

    _resetFieldsForProfile() {
        this._initEmptyFields();
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
            this._initEmptyFields();
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

        const parsedFields = state.fields || [];
        if (parsedFields.length > 0) {
            this.fields = parsedFields.map(f => ({
                id: nextFieldId(),
                fieldName: f.fieldName || '',
                aggregate: f.aggregate || '',
                alias: f.alias || ''
            }));
        } else {
            this._initEmptyFields();
        }

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

    get singleFieldLabel() {
        const labels = {
            flatGauge: 'Gauge Value',
            polarGauge: 'Gauge Value',
            ratingsChart: 'Rating Value'
        };
        return labels[this._chartType] || 'Value';
    }

    get fieldsHelpText() {
        const hints = {
            barChart: 'Add Group By fields for chart categories and a Measure for the aggregated value.',
            lineChart: 'Add a Group By field for the X-axis and Measure fields for each line.',
            pipelineChart: 'Add a Group By field for pipeline stages and a Measure for stage values.',
            waterfallChart: 'Add a Group By field for each step and a Measure for the step value.',
            flatGauge: 'Select the field and aggregate function that produces the gauge value.',
            polarGauge: 'Select the field and aggregate function that produces the gauge value.',
            ratingsChart: 'Select the field and aggregate function that produces the rating value.'
        };
        return hints[this._chartType] || '';
    }

    /**
     * Derive a role label for each field based on aggregate status.
     * Non-aggregate fields are "Group By" (they appear in GROUP BY).
     * Aggregate fields are "Measure" (they get aggregated).
     */
    _getFieldRoleLabel(field, idx) {
        if (this.isSingleMode) return this.singleFieldLabel;
        if (field.aggregate) {
            const measureIdx = this.fields.filter((f, i) => i < idx && f.aggregate).length;
            return measureIdx === 0 ? 'Measure' : 'Measure ' + (measureIdx + 1);
        }
        const catIdx = this.fields.filter((f, i) => i < idx && !f.aggregate).length;
        return catIdx === 0 ? 'Group By' : 'Group By ' + (catIdx + 1);
    }

    _fireQueryChange() {
        const detail = {
            value: '',
            labelField: null,
            valueField: null,
            seriesField: null,
            secondaryValueField: null
        };

        if (this.isRawMode) {
            detail.value = this.rawQuery;
        } else {
            const state = this._buildState();
            detail.value = buildSoql(state, this.profile) || '';
        }

        // Auto-populate chart config fields from field positions
        if (!this.isRawMode) {
            const categories = this.fields.filter(f => f.fieldName && !f.aggregate);
            const measures = this.fields.filter(f => f.fieldName && f.aggregate);

            // First category -> labelField
            if (categories.length > 0) {
                detail.labelField = categories[0].fieldName;
            }
            // First measure -> valueField (by alias)
            if (measures.length > 0) {
                detail.valueField = measures[0].alias || measures[0].fieldName;
            }
            // Second category -> seriesField
            if (categories.length > 1) {
                detail.seriesField = categories[1].fieldName;
            }
            // Second measure -> secondaryValueField (by alias)
            if (measures.length > 1) {
                detail.secondaryValueField = measures[1].alias || measures[1].fieldName;
            }
        }

        this.dispatchEvent(new CustomEvent('querychange', {
            detail,
            bubbles: false,
            composed: false
        }));
    }
}
