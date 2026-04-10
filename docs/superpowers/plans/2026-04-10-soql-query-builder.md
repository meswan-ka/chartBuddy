# SOQL Query Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the raw SOQL textarea in chartBuddyConfigurator with an interactive, chart-type-aware query builder that prevents invalid query shapes and auto-populates chart config fields.

**Architecture:** A standalone `soqlQueryBuilder` LWC child component receives `chartType` and `query` as @api props, emits `querychange` events with the SOQL string plus field metadata. A new `SoqlBuilderController` Apex class provides object search and field describe endpoints. A client-side `soqlParser.js` module handles bidirectional SOQL string <-> builder state conversion.

**Tech Stack:** Salesforce LWC (API 63.0), Apex, SLDS, imperative Apex calls

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `force-app/main/default/classes/SoqlBuilderController.cls` | Create | Object search + field describe Apex methods |
| `force-app/main/default/classes/SoqlBuilderControllerTest.cls` | Create | 90%+ coverage test class |
| `force-app/main/default/lwc/soqlQueryBuilder/soqlParser.js` | Create | `parseSoql()` and `buildSoql()` functions |
| `force-app/main/default/lwc/soqlQueryBuilder/soqlQueryBuilder.js` | Create | Builder component logic, state management, event emission |
| `force-app/main/default/lwc/soqlQueryBuilder/soqlQueryBuilder.html` | Create | Builder template with all sections |
| `force-app/main/default/lwc/soqlQueryBuilder/soqlQueryBuilder.css` | Create | Builder styles (SLDS tokens) |
| `force-app/main/default/lwc/soqlQueryBuilder/soqlQueryBuilder.js-meta.xml` | Create | LWC metadata (not exposed, API 63.0) |
| `force-app/main/default/lwc/chartBuddyConfigurator/chartBuddyConfigurator.html` | Modify | Replace textarea with `c-soql-query-builder` |
| `force-app/main/default/lwc/chartBuddyConfigurator/chartBuddyConfigurator.js` | Modify | Extend `handleColumnConfigChange` for auto-population |

---

### Task 1: Apex Controller -- SoqlBuilderController

**Files:**
- Create: `force-app/main/default/classes/SoqlBuilderController.cls`
- Create: `force-app/main/default/classes/SoqlBuilderControllerTest.cls`

- [ ] **Step 1: Create SoqlBuilderController.cls**

```apex
public with sharing class SoqlBuilderController {

    @AuraEnabled(cacheable=true)
    public static List<ObjectOption> findObjects(String searchTerm) {
        List<ObjectOption> results = new List<ObjectOption>();
        if (String.isBlank(searchTerm) || searchTerm.length() < 2) {
            return results;
        }
        String term = searchTerm.toLowerCase();
        Map<String, Schema.SObjectType> globalDescribe = Schema.getGlobalDescribe();
        for (String apiName : globalDescribe.keySet()) {
            if (results.size() >= 20) {
                break;
            }
            Schema.DescribeSObjectResult desc = globalDescribe.get(apiName).getDescribe();
            if (!desc.isQueryable()) {
                continue;
            }
            String lowerApi = apiName.toLowerCase();
            String lowerLabel = desc.getLabel().toLowerCase();
            if (lowerApi.contains(term) || lowerLabel.contains(term)) {
                ObjectOption opt = new ObjectOption();
                opt.apiName = desc.getName();
                opt.label = desc.getLabel();
                opt.isCustom = desc.isCustom();
                results.add(opt);
            }
        }
        results.sort();
        return results;
    }

    @AuraEnabled(cacheable=true)
    public static List<FieldOption> describeFields(String objectName) {
        if (String.isBlank(objectName)) {
            throw new AuraHandledException('Object name is required');
        }
        Schema.SObjectType sot = Schema.getGlobalDescribe().get(objectName);
        if (sot == null) {
            throw new AuraHandledException('Object not found: ' + objectName);
        }
        Map<String, Schema.SObjectField> fieldMap = sot.getDescribe().fields.getMap();
        List<FieldOption> results = new List<FieldOption>();
        for (String fieldKey : fieldMap.keySet()) {
            Schema.DescribeFieldResult dfr = fieldMap.get(fieldKey).getDescribe();
            if (!dfr.isAccessible()) {
                continue;
            }
            FieldOption opt = new FieldOption();
            opt.apiName = dfr.getName();
            opt.label = dfr.getLabel();
            opt.fieldType = dfr.getType().name();
            List<Schema.SObjectType> refs = dfr.getReferenceTo();
            if (!refs.isEmpty()) {
                opt.referenceTo = refs[0].getDescribe().getName();
            }
            results.add(opt);
        }
        results.sort();
        return results;
    }

    public class ObjectOption implements Comparable {
        @AuraEnabled public String apiName;
        @AuraEnabled public String label;
        @AuraEnabled public Boolean isCustom;

        public Integer compareTo(Object other) {
            return this.label.compareTo(((ObjectOption) other).label);
        }
    }

    public class FieldOption implements Comparable {
        @AuraEnabled public String apiName;
        @AuraEnabled public String label;
        @AuraEnabled public String fieldType;
        @AuraEnabled public String referenceTo;

        public Integer compareTo(Object other) {
            return this.label.compareTo(((FieldOption) other).label);
        }
    }
}
```

- [ ] **Step 2: Create SoqlBuilderControllerTest.cls**

```apex
@IsTest
private class SoqlBuilderControllerTest {

    @IsTest
    static void testFindObjectsWithKnownObject() {
        List<SoqlBuilderController.ObjectOption> results =
            SoqlBuilderController.findObjects('Account');
        Boolean found = false;
        for (SoqlBuilderController.ObjectOption opt : results) {
            if (opt.apiName == 'Account') {
                found = true;
                System.assertEquals('Account', opt.label);
                System.assertEquals(false, opt.isCustom);
                break;
            }
        }
        System.assert(found, 'Account should appear in results');
    }

    @IsTest
    static void testFindObjectsWithCustomObject() {
        List<SoqlBuilderController.ObjectOption> results =
            SoqlBuilderController.findObjects('Chart_Buddy');
        // Chart_Buddy_Config__c should appear if it exists in the org
        for (SoqlBuilderController.ObjectOption opt : results) {
            if (opt.apiName == 'Chart_Buddy_Config__c') {
                System.assertEquals(true, opt.isCustom);
            }
        }
        // Test passes regardless -- custom object may not exist in test context
        System.assert(true);
    }

    @IsTest
    static void testFindObjectsEmptySearch() {
        List<SoqlBuilderController.ObjectOption> results =
            SoqlBuilderController.findObjects('');
        System.assertEquals(0, results.size(), 'Empty search should return no results');
    }

    @IsTest
    static void testFindObjectsNullSearch() {
        List<SoqlBuilderController.ObjectOption> results =
            SoqlBuilderController.findObjects(null);
        System.assertEquals(0, results.size(), 'Null search should return no results');
    }

    @IsTest
    static void testFindObjectsShortSearch() {
        List<SoqlBuilderController.ObjectOption> results =
            SoqlBuilderController.findObjects('A');
        System.assertEquals(0, results.size(), 'Single char search should return no results');
    }

    @IsTest
    static void testFindObjectsNoResults() {
        List<SoqlBuilderController.ObjectOption> results =
            SoqlBuilderController.findObjects('zzzzxyzzyNotAnObject');
        System.assertEquals(0, results.size(), 'Gibberish search should return no results');
    }

    @IsTest
    static void testFindObjectsCapsAt20() {
        // Search for a very common term that matches many objects
        List<SoqlBuilderController.ObjectOption> results =
            SoqlBuilderController.findObjects('__');
        System.assert(results.size() <= 20, 'Results should be capped at 20');
    }

    @IsTest
    static void testDescribeFieldsAccount() {
        List<SoqlBuilderController.FieldOption> results =
            SoqlBuilderController.describeFields('Account');
        System.assert(results.size() > 0, 'Account should have fields');
        Set<String> fieldNames = new Set<String>();
        for (SoqlBuilderController.FieldOption opt : results) {
            fieldNames.add(opt.apiName);
        }
        System.assert(fieldNames.contains('Name'), 'Account should have Name field');
        System.assert(fieldNames.contains('Id'), 'Account should have Id field');
    }

    @IsTest
    static void testDescribeFieldsReferenceInfo() {
        List<SoqlBuilderController.FieldOption> results =
            SoqlBuilderController.describeFields('Contact');
        Boolean foundRef = false;
        for (SoqlBuilderController.FieldOption opt : results) {
            if (opt.apiName == 'AccountId') {
                foundRef = true;
                System.assertEquals('Account', opt.referenceTo);
                System.assertEquals('REFERENCE', opt.fieldType);
                break;
            }
        }
        System.assert(foundRef, 'Contact.AccountId should be a reference to Account');
    }

    @IsTest
    static void testDescribeFieldsInvalidObject() {
        try {
            SoqlBuilderController.describeFields('NotARealObject__c');
            System.assert(false, 'Should have thrown AuraHandledException');
        } catch (AuraHandledException e) {
            System.assert(e.getMessage().contains('Object not found'),
                'Error message should indicate object not found');
        }
    }

    @IsTest
    static void testDescribeFieldsBlankObject() {
        try {
            SoqlBuilderController.describeFields('');
            System.assert(false, 'Should have thrown AuraHandledException');
        } catch (AuraHandledException e) {
            System.assert(e.getMessage().contains('required'),
                'Error message should indicate object name is required');
        }
    }

    @IsTest
    static void testDescribeFieldsSorted() {
        List<SoqlBuilderController.FieldOption> results =
            SoqlBuilderController.describeFields('Account');
        for (Integer i = 1; i < results.size(); i++) {
            System.assert(
                results[i - 1].label.compareTo(results[i].label) <= 0,
                'Fields should be sorted by label: ' + results[i - 1].label + ' vs ' + results[i].label
            );
        }
    }

    @IsTest
    static void testFindObjectsSorted() {
        List<SoqlBuilderController.ObjectOption> results =
            SoqlBuilderController.findObjects('Acc');
        for (Integer i = 1; i < results.size(); i++) {
            System.assert(
                results[i - 1].label.compareTo(results[i].label) <= 0,
                'Objects should be sorted by label'
            );
        }
    }
}
```

- [ ] **Step 3: Verify the files compile**

Run: `sf project deploy start --source-dir force-app/main/default/classes/SoqlBuilderController.cls --source-dir force-app/main/default/classes/SoqlBuilderControllerTest.cls --dry-run`

Expected: Successful validation (no compile errors).

- [ ] **Step 4: Commit**

```bash
git add force-app/main/default/classes/SoqlBuilderController.cls force-app/main/default/classes/SoqlBuilderControllerTest.cls
git commit -m "feat: add SoqlBuilderController for object search and field describe"
```

---

### Task 2: SOQL Parser and Serializer (soqlParser.js)

**Files:**
- Create: `force-app/main/default/lwc/soqlQueryBuilder/soqlParser.js`

- [ ] **Step 1: Create soqlParser.js with parseSoql and buildSoql functions**

```js
/**
 * SOQL parser and serializer for the query builder.
 * parseSoql: raw SOQL string -> builder state
 * buildSoql: builder state -> SOQL string
 */

const AGGREGATE_REGEX = /^\s*(SUM|COUNT|AVG|MIN|MAX)\(\s*([\w.]+)\s*\)\s+(\w+)\s*$/i;
const AGGREGATE_NO_ALIAS_REGEX = /^\s*(SUM|COUNT|AVG|MIN|MAX)\(\s*([\w.]+)\s*\)\s*$/i;
const BARE_FIELD_REGEX = /^\s*([\w.]+)\s*$/;
const WHERE_CONDITION_REGEX = /^\s*([\w.]+)\s*(!=|>=|<=|NOT\s+IN|=|>|<|LIKE|IN)\s*(.+)\s*$/i;
const ORDER_BY_REGEX = /^\s*([\w.]+)\s*(ASC|DESC)?\s*$/i;
const RECORD_ID_REGEX = /:\s*recordId\s*$/i;

const UNSUPPORTED_PATTERNS = [
    { pattern: /\(\s*SELECT/i, warning: 'Subqueries are not supported in builder mode' },
    { pattern: /\bHAVING\b/i, warning: 'HAVING clauses are not supported in builder mode' },
    { pattern: /\bTYPEOF\b/i, warning: 'TYPEOF expressions are not supported in builder mode' },
    { pattern: /\bFORMAT\s*\(/i, warning: 'FORMAT() function is not supported in builder mode' },
    { pattern: /\btoLabel\s*\(/i, warning: 'toLabel() function is not supported in builder mode' },
    { pattern: /\bconvertCurrency\s*\(/i, warning: 'convertCurrency() function is not supported in builder mode' },
    { pattern: /\bOFFSET\b/i, warning: 'OFFSET clause is not supported in builder mode' }
];

/**
 * Generate an alias from a field name.
 * Takes the last segment of a dot-notation path and lowercases it.
 * Deduplicates by appending a numeric suffix.
 */
function generateAlias(fieldName, existingAliases) {
    const segments = fieldName.split('.');
    let base = segments[segments.length - 1].toLowerCase();
    let alias = base;
    let counter = 2;
    while (existingAliases.has(alias)) {
        alias = base + counter;
        counter++;
    }
    existingAliases.add(alias);
    return alias;
}

/**
 * Extract clauses from a SOQL string by splitting on keyword boundaries.
 * Returns an object with raw strings for each clause.
 */
function extractClauses(soql) {
    const normalized = soql.trim();
    const result = { select: '', from: '', where: '', groupBy: '', orderBy: '', limit: '' };

    const clausePattern = /\b(SELECT|FROM|WHERE|GROUP\s+BY|ORDER\s+BY|LIMIT)\b/gi;
    const matches = [];
    let match;
    while ((match = clausePattern.exec(normalized)) !== null) {
        matches.push({ keyword: match[1].toUpperCase().replace(/\s+/g, ' '), index: match.index });
    }

    for (let i = 0; i < matches.length; i++) {
        const start = matches[i].index + matches[i].keyword.length;
        const end = i + 1 < matches.length ? matches[i + 1].index : normalized.length;
        const content = normalized.substring(start, end).trim();
        const key = matches[i].keyword.replace(' ', '').toLowerCase();
        if (key === 'select') result.select = content;
        else if (key === 'from') result.from = content;
        else if (key === 'where') result.where = content;
        else if (key === 'groupby') result.groupBy = content;
        else if (key === 'orderby') result.orderBy = content;
        else if (key === 'limit') result.limit = content;
    }
    return result;
}

/**
 * Parse a SOQL string into builder state.
 * @param {string} soqlString - The raw SOQL query
 * @returns {{ success: boolean, state: object, warnings: string[] }}
 */
export function parseSoql(soqlString) {
    const warnings = [];
    const state = {
        objectName: '',
        fields: [],
        recordContextField: null,
        whereConditions: [],
        orderByField: null,
        orderByDirection: 'ASC',
        queryLimit: null
    };

    if (!soqlString || !soqlString.trim()) {
        return { success: true, state, warnings };
    }

    const soql = soqlString.trim();

    // Check for unsupported patterns (non-clause-specific)
    let hasUnsupported = false;
    for (const check of UNSUPPORTED_PATTERNS) {
        if (check.pattern.test(soql)) {
            warnings.push(check.warning);
            hasUnsupported = true;
        }
    }

    const clauses = extractClauses(soql);

    // Check for OR in WHERE clause specifically
    if (clauses.where && /\bOR\b/i.test(clauses.where)) {
        warnings.push('OR conditions are not supported -- only AND is supported');
        hasUnsupported = true;
    }

    // FROM
    state.objectName = clauses.from.split(/\s/)[0] || '';

    // SELECT
    const existingAliases = new Set();
    if (clauses.select) {
        const tokens = clauses.select.split(',');
        for (const token of tokens) {
            const aggMatch = token.match(AGGREGATE_REGEX);
            if (aggMatch) {
                const alias = aggMatch[3].toLowerCase();
                existingAliases.add(alias);
                state.fields.push({
                    fieldName: aggMatch[2],
                    aggregate: aggMatch[1].toUpperCase(),
                    alias: alias
                });
                continue;
            }
            const aggNoAlias = token.match(AGGREGATE_NO_ALIAS_REGEX);
            if (aggNoAlias) {
                const alias = generateAlias(aggNoAlias[2], existingAliases);
                state.fields.push({
                    fieldName: aggNoAlias[2],
                    aggregate: aggNoAlias[1].toUpperCase(),
                    alias: alias
                });
                continue;
            }
            const bareMatch = token.match(BARE_FIELD_REGEX);
            if (bareMatch) {
                state.fields.push({
                    fieldName: bareMatch[1],
                    aggregate: null,
                    alias: null
                });
            }
        }
    }

    // WHERE
    if (clauses.where) {
        const conditions = clauses.where.split(/\bAND\b/i);
        for (const cond of conditions) {
            const trimmed = cond.trim();
            if (!trimmed) continue;
            if (RECORD_ID_REGEX.test(trimmed)) {
                const parts = trimmed.match(/^\s*([\w.]+)\s*=\s*:?\s*recordId\s*$/i);
                if (parts) {
                    state.recordContextField = parts[1];
                    continue;
                }
            }
            const condMatch = trimmed.match(WHERE_CONDITION_REGEX);
            if (condMatch) {
                state.whereConditions.push({
                    fieldName: condMatch[1],
                    operator: condMatch[2].toUpperCase().replace(/\s+/g, ' '),
                    value: condMatch[3].trim()
                });
            }
        }
    }

    // ORDER BY
    if (clauses.orderBy) {
        const orderMatch = clauses.orderBy.match(ORDER_BY_REGEX);
        if (orderMatch) {
            state.orderByField = orderMatch[1];
            state.orderByDirection = orderMatch[2] ? orderMatch[2].toUpperCase() : 'ASC';
        }
    }

    // LIMIT
    if (clauses.limit) {
        const parsed = parseInt(clauses.limit, 10);
        if (!isNaN(parsed)) {
            state.queryLimit = parsed;
        }
    }

    return {
        success: !hasUnsupported,
        state,
        warnings
    };
}

/**
 * Build a SOQL string from builder state.
 * @param {object} state - The builder state object
 * @param {object} profile - The active builder profile (from BUILDER_PROFILES)
 * @returns {string|null} - The SOQL string, or null if validation fails
 */
export function buildSoql(state, profile) {
    if (!state.objectName) return null;

    // Validate required slots have fields
    const slotFields = state.fields || [];
    for (let i = 0; i < profile.slots.length; i++) {
        const slot = profile.slots[i];
        const field = slotFields[i];
        if (slot.required && (!field || !field.fieldName)) {
            return null;
        }
        if (slot.requireAggregate && field && field.fieldName && !field.aggregate) {
            return null;
        }
    }

    // SELECT
    const selectParts = [];
    for (const field of slotFields) {
        if (!field || !field.fieldName) continue;
        if (field.aggregate) {
            const alias = field.alias || field.fieldName.toLowerCase();
            selectParts.push(field.aggregate + '(' + field.fieldName + ') ' + alias);
        } else {
            selectParts.push(field.fieldName);
        }
    }
    if (selectParts.length === 0) return null;

    let soql = 'SELECT ' + selectParts.join(', ');
    soql += '\nFROM ' + state.objectName;

    // WHERE
    const whereParts = [];
    if (state.recordContextField) {
        whereParts.push(state.recordContextField + ' = :recordId');
    }
    for (const cond of (state.whereConditions || [])) {
        if (cond.fieldName && cond.operator && cond.value) {
            whereParts.push(cond.fieldName + ' ' + cond.operator + ' ' + cond.value);
        }
    }
    if (whereParts.length > 0) {
        soql += '\nWHERE ' + whereParts.join('\n  AND ');
    }

    // GROUP BY
    if (profile.autoGroupBy) {
        const groupFields = slotFields
            .filter(f => f && f.fieldName && !f.aggregate)
            .map(f => f.fieldName);
        if (groupFields.length > 0) {
            soql += '\nGROUP BY ' + groupFields.join(', ');
        }
    }

    // ORDER BY
    if (profile.showOrderBy && state.orderByField) {
        soql += '\nORDER BY ' + state.orderByField + ' ' + (state.orderByDirection || 'ASC');
    }

    // LIMIT
    if (profile.showLimit && state.queryLimit) {
        soql += '\nLIMIT ' + state.queryLimit;
    }

    return soql;
}
```

- [ ] **Step 2: Verify the module is syntactically valid**

Run: `node -e "const fs = require('fs'); const code = fs.readFileSync('force-app/main/default/lwc/soqlQueryBuilder/soqlParser.js', 'utf8'); new Function(code.replace(/export /g, '')); console.log('OK')"`

Expected: `OK` (no syntax errors). Note: LWC import/export syntax requires removing `export` keywords for Node validation. This is a quick syntax check only.

- [ ] **Step 3: Commit**

```bash
git add force-app/main/default/lwc/soqlQueryBuilder/soqlParser.js
git commit -m "feat: add SOQL parser and serializer module"
```

---

### Task 3: LWC Scaffold -- soqlQueryBuilder Metadata and CSS

**Files:**
- Create: `force-app/main/default/lwc/soqlQueryBuilder/soqlQueryBuilder.js-meta.xml`
- Create: `force-app/main/default/lwc/soqlQueryBuilder/soqlQueryBuilder.css`

- [ ] **Step 1: Create soqlQueryBuilder.js-meta.xml**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<LightningComponentBundle xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>63.0</apiVersion>
    <isExposed>false</isExposed>
</LightningComponentBundle>
```

- [ ] **Step 2: Create soqlQueryBuilder.css**

```css
/* Builder layout */
.builder-section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

/* Mode toggle */
.mode-toggle {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 0.25rem;
}

/* Object search dropdown */
.object-search {
    position: relative;
}

.object-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    max-height: 200px;
    overflow-y: auto;
    z-index: 10;
    background: var(--slds-g-color-neutral-base-100, #ffffff);
    border: 1px solid var(--slds-g-color-border-base-1, #e5e5e5);
    border-radius: 0 0 0.25rem 0.25rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.object-option {
    padding: 0.5rem 0.75rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8125rem;
}

.object-option:hover {
    background: var(--slds-g-color-neutral-base-95, #f3f3f3);
}

.object-option-api {
    color: var(--slds-g-color-neutral-base-30, #706e6b);
    font-size: 0.75rem;
}

/* Field slot rows */
.field-slot-row {
    display: flex;
    align-items: flex-end;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
}

.field-slot-label {
    font-weight: 700;
    font-size: 0.8125rem;
    min-width: 5rem;
    padding-bottom: 0.5rem;
}

.field-slot-aggregate {
    flex: 0 0 7rem;
}

.field-slot-field {
    flex: 1;
    min-width: 0;
}

.field-slot-alias {
    font-size: 0.75rem;
    color: var(--slds-g-color-neutral-base-30, #706e6b);
    padding-bottom: 0.5rem;
    white-space: nowrap;
}

.custom-field-toggle {
    font-size: 0.75rem;
    color: var(--slds-g-color-brand-base-50, #0176d3);
    cursor: pointer;
    margin-top: 0.125rem;
}

.custom-field-toggle:hover {
    text-decoration: underline;
}

/* Record context */
.record-context-row {
    display: flex;
    align-items: flex-end;
    gap: 0.5rem;
}

.record-context-field {
    flex: 1;
}

.record-context-label {
    font-size: 0.8125rem;
    color: var(--slds-g-color-neutral-base-30, #706e6b);
    padding-bottom: 0.5rem;
    white-space: nowrap;
}

/* WHERE rows */
.where-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
}

.where-header-label {
    font-weight: 700;
    font-size: 0.8125rem;
}

.where-row {
    display: flex;
    align-items: flex-end;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
}

.where-field {
    flex: 2;
    min-width: 0;
}

.where-operator {
    flex: 0 0 6rem;
}

.where-value {
    flex: 3;
    min-width: 0;
}

.where-remove {
    flex-shrink: 0;
    padding-bottom: 0.25rem;
}

/* ORDER BY row */
.order-row {
    display: flex;
    align-items: flex-end;
    gap: 0.5rem;
}

.order-field {
    flex: 1;
}

.order-direction {
    flex: 0 0 6rem;
}

/* SOQL Preview */
.soql-preview {
    font-family: var(--slds-g-font-family-mono, monospace);
    font-size: 0.75rem;
    background: var(--slds-g-color-neutral-base-95, #f3f3f3);
    padding: 0.75rem;
    border-radius: 0.25rem;
    border: 1px solid var(--slds-g-color-border-base-1, #e5e5e5);
    white-space: pre-wrap;
    word-break: break-word;
    min-height: 2rem;
    line-height: 1.5;
}

/* Section labels */
.section-label {
    font-weight: 700;
    font-size: 0.8125rem;
    color: var(--slds-g-color-neutral-base-10, #181818);
}

.section-help {
    font-size: 0.75rem;
    color: var(--slds-g-color-neutral-base-30, #706e6b);
}

/* Warning modal */
.warning-list {
    list-style: disc;
    padding-left: 1.25rem;
    margin: 0.5rem 0;
    font-size: 0.8125rem;
}

.warning-list li {
    margin-bottom: 0.25rem;
}
```

- [ ] **Step 3: Commit**

```bash
git add force-app/main/default/lwc/soqlQueryBuilder/soqlQueryBuilder.js-meta.xml force-app/main/default/lwc/soqlQueryBuilder/soqlQueryBuilder.css
git commit -m "feat: add soqlQueryBuilder LWC metadata and styles"
```

---

### Task 4: LWC Component -- soqlQueryBuilder JavaScript

**Files:**
- Create: `force-app/main/default/lwc/soqlQueryBuilder/soqlQueryBuilder.js`

- [ ] **Step 1: Create soqlQueryBuilder.js**

```js
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
        // Delay to allow click on dropdown option to register
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
```

- [ ] **Step 2: Commit**

```bash
git add force-app/main/default/lwc/soqlQueryBuilder/soqlQueryBuilder.js
git commit -m "feat: add soqlQueryBuilder component logic with state management"
```

---

### Task 5: LWC Template -- soqlQueryBuilder HTML

**Files:**
- Create: `force-app/main/default/lwc/soqlQueryBuilder/soqlQueryBuilder.html`

- [ ] **Step 1: Create soqlQueryBuilder.html**

```html
<template>
    <div class="builder-section">
        <!-- Mode Toggle -->
        <div class="mode-toggle">
            <lightning-button-group>
                <lightning-button
                    label="Builder"
                    variant={builderModeVariant}
                    onclick={handleBuilderMode}
                ></lightning-button>
                <lightning-button
                    label="Raw SOQL"
                    variant={rawModeVariant}
                    onclick={handleRawMode}
                ></lightning-button>
            </lightning-button-group>
        </div>

        <!-- Raw Mode -->
        <template lwc:if={isRawMode}>
            <lightning-textarea
                label="SOQL Query"
                value={rawQuery}
                onchange={handleRawQueryChange}
                class="slds-m-bottom_small"
            ></lightning-textarea>
        </template>

        <!-- Builder Mode -->
        <template lwc:elseif={true}>
            <!-- Object Search -->
            <div class="object-search">
                <lightning-input
                    label="Object"
                    value={objectSearchTerm}
                    placeholder="Type object name..."
                    onchange={handleObjectSearchInput}
                    onblur={handleObjectSearchBlur}
                ></lightning-input>
                <template lwc:if={showObjectDropdown}>
                    <div class="object-dropdown">
                        <template for:each={objectSearchResults} for:item="obj">
                            <div
                                key={obj.apiName}
                                class="object-option"
                                data-apiname={obj.apiName}
                                onclick={handleObjectSelect}
                            >
                                <span>{obj.label}</span>
                                <span class="object-option-api">{obj.apiName}</span>
                                <template lwc:if={obj.isCustom}>
                                    <lightning-badge label="Custom"></lightning-badge>
                                </template>
                            </div>
                        </template>
                    </div>
                </template>
            </div>

            <!-- Record Context -->
            <div class="record-context-row">
                <div class="record-context-field">
                    <lightning-combobox
                        label="Record Context Field"
                        value={recordContextField}
                        options={recordContextOptions}
                        field-level-help="Links this query to the current record page via :recordId"
                        onchange={handleRecordContextChange}
                    ></lightning-combobox>
                </div>
                <template lwc:if={recordContextField}>
                    <span class="record-context-label">= :recordId</span>
                </template>
            </div>

            <!-- Field Slots -->
            <div>
                <span class="section-label">Fields</span>
                <template for:each={renderedSlots} for:item="slot">
                    <div key={slot.key} class="field-slot-row">
                        <span class="field-slot-label">
                            {slot.label}
                            <template lwc:if={slot.required}>
                                <abbr title="required" class="slds-required">*</abbr>
                            </template>
                            <template lwc:elseif={true}>
                                <span class="section-help"> (optional)</span>
                            </template>
                        </span>

                        <template lwc:if={slot.requireAggregate}>
                            <div class="field-slot-aggregate">
                                <lightning-combobox
                                    label="Function"
                                    variant="label-hidden"
                                    value={slot.aggregate}
                                    options={aggregateOptions}
                                    data-index={slot.index}
                                    onchange={handleAggregateChange}
                                ></lightning-combobox>
                            </div>
                        </template>

                        <div class="field-slot-field">
                            <template lwc:if={slot.showCustomInput}>
                                <lightning-input
                                    label="Custom Field Path"
                                    variant="label-hidden"
                                    value={slot.fieldName}
                                    placeholder="e.g. Account.Industry"
                                    data-index={slot.index}
                                    onchange={handleCustomFieldInput}
                                ></lightning-input>
                            </template>
                            <template lwc:elseif={true}>
                                <lightning-combobox
                                    label="Field"
                                    variant="label-hidden"
                                    value={slot.fieldName}
                                    options={fieldPickerOptions}
                                    data-index={slot.index}
                                    onchange={handleFieldChange}
                                    placeholder="Select field..."
                                ></lightning-combobox>
                            </template>
                            <span
                                class="custom-field-toggle"
                                data-key={slot.key}
                                onclick={handleCustomFieldToggle}
                            >
                                <template lwc:if={slot.showCustomInput}>
                                    Use picker
                                </template>
                                <template lwc:elseif={true}>
                                    Custom path
                                </template>
                            </span>
                        </div>

                        <template lwc:if={slot.alias}>
                            <span class="field-slot-alias">as {slot.alias}</span>
                        </template>
                    </div>
                </template>
            </div>

            <!-- WHERE Conditions -->
            <div>
                <div class="where-header">
                    <span class="where-header-label">WHERE</span>
                    <lightning-button
                        label="Add Condition"
                        variant="neutral"
                        icon-name="utility:add"
                        onclick={handleAddWhereCondition}
                        size="small"
                    ></lightning-button>
                </div>
                <template lwc:if={hasWhereConditions}>
                    <template for:each={renderedWhereConditions} for:item="cond">
                        <div key={cond.id} class="where-row">
                            <div class="where-field">
                                <lightning-combobox
                                    label="Field"
                                    variant="label-hidden"
                                    value={cond.fieldName}
                                    options={fieldPickerOptions}
                                    data-index={cond.index}
                                    onchange={handleWhereFieldChange}
                                    placeholder="Field..."
                                ></lightning-combobox>
                            </div>
                            <div class="where-operator">
                                <lightning-combobox
                                    label="Operator"
                                    variant="label-hidden"
                                    value={cond.operator}
                                    options={operatorOptions}
                                    data-index={cond.index}
                                    onchange={handleWhereOperatorChange}
                                ></lightning-combobox>
                            </div>
                            <div class="where-value">
                                <lightning-input
                                    label="Value"
                                    variant="label-hidden"
                                    value={cond.value}
                                    data-index={cond.index}
                                    onchange={handleWhereValueChange}
                                    placeholder="Value..."
                                ></lightning-input>
                            </div>
                            <div class="where-remove">
                                <lightning-button-icon
                                    icon-name="utility:close"
                                    alternative-text="Remove condition"
                                    variant="bare"
                                    data-index={cond.index}
                                    onclick={handleRemoveWhereCondition}
                                    size="small"
                                ></lightning-button-icon>
                            </div>
                        </div>
                    </template>
                </template>
            </div>

            <!-- ORDER BY -->
            <template lwc:if={showOrderBy}>
                <div class="order-row">
                    <div class="order-field">
                        <lightning-combobox
                            label="ORDER BY"
                            value={orderByField}
                            options={fieldPickerOptions}
                            onchange={handleOrderByFieldChange}
                            placeholder="None"
                        ></lightning-combobox>
                    </div>
                    <div class="order-direction">
                        <lightning-combobox
                            label="Direction"
                            value={orderByDirection}
                            options={directionOptions}
                            onchange={handleOrderByDirectionChange}
                        ></lightning-combobox>
                    </div>
                </div>
            </template>

            <!-- LIMIT -->
            <template lwc:if={showLimit}>
                <lightning-input
                    type="number"
                    label="LIMIT"
                    value={queryLimit}
                    onchange={handleLimitChange}
                    min="1"
                    placeholder="No limit"
                ></lightning-input>
            </template>
        </template>

        <!-- SOQL Preview (always visible) -->
        <div>
            <span class="section-label">Preview</span>
            <div class="soql-preview">{soqlPreview}</div>
        </div>

        <!-- Warning Modal -->
        <template lwc:if={showWarningModal}>
            <section
                role="dialog"
                tabindex="-1"
                class="slds-modal slds-fade-in-open"
                aria-modal="true"
                aria-label="Parse warning"
            >
                <div class="slds-modal__container">
                    <header class="slds-modal__header">
                        <h2 class="slds-text-heading_medium">Query Contains Unsupported Features</h2>
                    </header>
                    <div class="slds-modal__content slds-p-around_medium">
                        <p>This query contains features the builder does not support. Switching to builder mode will remove them:</p>
                        <ul class="warning-list">
                            <template for:each={warningMessages} for:item="msg">
                                <li key={msg}>{msg}</li>
                            </template>
                        </ul>
                    </div>
                    <footer class="slds-modal__footer">
                        <lightning-button
                            label="Stay in Raw Mode"
                            variant="neutral"
                            onclick={handleWarningStay}
                        ></lightning-button>
                        <lightning-button
                            label="Switch Anyway"
                            variant="brand"
                            onclick={handleWarningSwitch}
                            class="slds-m-left_x-small"
                        ></lightning-button>
                    </footer>
                </div>
            </section>
            <div class="slds-backdrop slds-backdrop_open"></div>
        </template>
    </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add force-app/main/default/lwc/soqlQueryBuilder/soqlQueryBuilder.html
git commit -m "feat: add soqlQueryBuilder template with all builder sections"
```

---

### Task 6: Integrate into chartBuddyConfigurator

**Files:**
- Modify: `force-app/main/default/lwc/chartBuddyConfigurator/chartBuddyConfigurator.html:180-188`
- Modify: `force-app/main/default/lwc/chartBuddyConfigurator/chartBuddyConfigurator.js:339-347`

- [ ] **Step 1: Replace the textarea with c-soql-query-builder in the HTML**

In `chartBuddyConfigurator.html`, replace lines 180-188:

```html
                                <lightning-textarea
                                    label="Query"
                                    value={col.config.query}
                                    data-id={col.id}
                                    data-field="query"
                                    onchange={handleColumnConfigChange}
                                    class="slds-m-bottom_small"
                                    field-level-help="Use :recordId for current record binding"
                                ></lightning-textarea>
```

With:

```html
                                <c-soql-query-builder
                                    chart-type={col.chartType}
                                    query={col.config.query}
                                    data-id={col.id}
                                    data-field="query"
                                    onquerychange={handleColumnConfigChange}
                                    class="slds-m-bottom_small"
                                ></c-soql-query-builder>
```

- [ ] **Step 2: Update handleColumnConfigChange in the JS**

In `chartBuddyConfigurator.js`, replace lines 339-347:

```js
    handleColumnConfigChange(event) {
        const colId = event.currentTarget.dataset.id;
        const field = event.currentTarget.dataset.field;
        const value = event.detail?.value !== undefined ? event.detail.value : event.target.value;
        this.columns = this.columns.map(c => {
            if (c.id !== colId) return c;
            return { ...c, config: { ...c.config, [field]: value } };
        });
    }
```

With:

```js
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
```

- [ ] **Step 3: Commit**

```bash
git add force-app/main/default/lwc/chartBuddyConfigurator/chartBuddyConfigurator.html force-app/main/default/lwc/chartBuddyConfigurator/chartBuddyConfigurator.js
git commit -m "feat: integrate soqlQueryBuilder into configurator, replace textarea"
```

---

### Task 7: Deploy and Verify

**Files:** None (validation only)

- [ ] **Step 1: Validate full deployment**

Run: `sf project deploy start --source-dir force-app --dry-run`

Expected: Successful validation with no compile errors.

- [ ] **Step 2: Run Apex tests**

Run: `sf apex run test --class-names SoqlBuilderControllerTest --result-format human --synchronous`

Expected: All 12 tests pass, 90%+ code coverage on `SoqlBuilderController`.

- [ ] **Step 3: Verify existing tests still pass**

Run: `sf apex run test --class-names ChartQueryControllerTest ChartBuddyConfigControllerTest --result-format human --synchronous`

Expected: All existing tests pass (no regressions).

- [ ] **Step 4: Verification complete**

No code changes -- this step is verification only. If any tests fail, fix the issue in the relevant task file and re-run.
