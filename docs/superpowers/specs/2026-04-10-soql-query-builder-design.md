# SOQL Query Builder -- Design Spec

**Date:** 2026-04-10
**Status:** Draft
**Scope:** Interactive, chart-aware SOQL query builder for chartBuddy configurator

---

## 1. Overview

Replace the plain `lightning-textarea` query input in `chartBuddyConfigurator` with an interactive SOQL query builder. The builder is chart-type-aware: it adapts its UI (visible fields, required aggregates, clause visibility) based on the selected chart type, preventing admins from constructing queries that don't match the chart's expected data shape.

Admins can toggle between the visual builder and raw SOQL editing. The builder also auto-populates chart config fields (`labelField`, `valueField`, etc.) from the selected query fields.

## 2. New Files

| File | Purpose |
|---|---|
| `force-app/main/default/lwc/soqlQueryBuilder/soqlQueryBuilder.js` | Builder component logic |
| `force-app/main/default/lwc/soqlQueryBuilder/soqlQueryBuilder.html` | Builder template |
| `force-app/main/default/lwc/soqlQueryBuilder/soqlQueryBuilder.css` | Builder styles |
| `force-app/main/default/lwc/soqlQueryBuilder/soqlQueryBuilder.js-meta.xml` | LWC metadata |
| `force-app/main/default/lwc/soqlQueryBuilder/soqlParser.js` | SOQL string parser (raw-to-builder) |
| `force-app/main/default/classes/SoqlBuilderController.cls` | Apex: object search + field describe |
| `force-app/main/default/classes/SoqlBuilderControllerTest.cls` | Apex test class (90%+ coverage) |

## 3. Modified Files

| File | Change |
|---|---|
| `chartBuddyConfigurator.html` | Replace `lightning-textarea[data-field="query"]` with `c-soql-query-builder` |
| `chartBuddyConfigurator.js` | Update `handleColumnConfigChange` to consume expanded event detail (auto-populate labelField, valueField, etc.) |

## 4. Component Interface

### 4.1 soqlQueryBuilder API

```html
<c-soql-query-builder
    chart-type={col.chartType}
    query={col.config.query}
    data-id={col.id}
    data-field="query"
    onquerychange={handleColumnConfigChange}
></c-soql-query-builder>
```

**@api properties:**

| Property | Type | Description |
|---|---|---|
| `chartType` | String | Current chart type. Drives builder profile (visible slots, constraints). |
| `query` | String | Initial SOQL string. Parsed into builder state on load and when set externally. |

**Events:**

| Event | Detail Shape | Description |
|---|---|---|
| `querychange` | `{ value, labelField, valueField, seriesField, secondaryValueField }` | Fires on every builder state change. `value` is the SOQL string. Field properties are the resolved API names or aliases for auto-populating chart config. |

### 4.2 Integration with Configurator

The `handleColumnConfigChange` handler in `chartBuddyConfigurator.js` currently reads `event.detail.value` and writes it to `config[field]`. It will be extended to check for the additional field properties in the event detail:

```js
handleColumnConfigChange(event) {
    const colId = event.currentTarget.dataset.id;
    const field = event.currentTarget.dataset.field;
    const value = event.detail?.value !== undefined ? event.detail.value : event.target.value;
    this.columns = this.columns.map(c => {
        if (c.id !== colId) return c;
        const updatedConfig = { ...c.config, [field]: value };
        // Auto-populate chart fields from builder metadata
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

## 5. Chart-Aware Builder Profiles

Each chart type defines a builder profile controlling which UI sections are visible, which field slots exist, and what constraints apply.

### 5.1 Profile Definitions

```js
const BUILDER_PROFILES = {
    barChart: {
        slots: [
            { key: 'label', label: 'Label', requireAggregate: false, required: true },
            { key: 'value', label: 'Value', requireAggregate: true, required: true },
            { key: 'series', label: 'Series', requireAggregate: false, required: false }
        ],
        autoGroupBy: true,       // GROUP BY auto-set from non-aggregate fields
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
```

### 5.2 Guardrails Enforced by Profiles

1. **Field slot visibility** -- Only slots defined in the profile are rendered. A `flatGauge` never shows a label or series slot.
2. **Aggregate requirement** -- Value slots force an aggregate function dropdown (SUM, COUNT, AVG, MIN, MAX). The dropdown has no "None" option. Label slots have no aggregate option.
3. **GROUP BY auto-management** -- When `autoGroupBy` is true, GROUP BY is computed from all non-aggregate field slots and is not user-editable. When false, GROUP BY section is hidden entirely.
4. **ORDER BY / LIMIT visibility** -- Hidden when profile says `false`. Cannot be configured for chart types where they're irrelevant.
5. **Slot count is fixed** -- No "Add Field" button. The profile defines exactly which slots exist. Admin fills them in, but can't add or remove slots.
6. **Chart type change** -- When `chartType` API property changes, builder resets field slots to the new profile defaults. Object name, record context field, and WHERE conditions are preserved.

## 6. UI Layout

The builder renders vertically inside the existing column detail area.

### 6.1 Sections (top to bottom)

**Mode Toggle**
- Two-segment button group: "Builder" / "Raw SOQL"
- Default: Builder mode
- Toggle fires parse/serialize logic (see Section 8)

**Object Search**
- `lightning-input` with placeholder "Type object name..."
- Debounced 300ms, triggers search on 2+ characters
- Results shown in a custom dropdown `div` below the input (not a combobox -- results are dynamic/async)
- Each result shows: `Label (ApiName)` with a custom object badge if applicable
- Selecting an object calls `describeFields` and populates field pickers
- Max 20 results returned

**Record Context (optional)**
- `lightning-combobox` populated from described fields (Reference and Id types prioritized at top)
- Label: "Record Context Field"
- Help text: "Links this query to the current record page via :recordId"
- Displays `= :recordId` as static text next to the combobox
- Can be cleared (set to `--None--`)

**Field Slots**
- One row per slot defined in the active profile
- Each row contains:
  - Slot label (e.g., "Label", "Value", "Series") as bold text
  - `lightning-combobox` for field selection, populated from described fields
  - For value slots: `lightning-combobox` for aggregate function (SUM, COUNT, AVG, MIN, MAX), inline before the field picker
  - For value slots: read-only alias text after the field picker, auto-generated as the last segment of the field API name lowercased (e.g., `Amount` -> `amount`, `Account.Industry` -> `industry`). If a duplicate alias would result, append a numeric suffix (`amount2`).
  - "Custom" link below each combobox -- reveals a `lightning-input` for typing arbitrary dot-notation paths (e.g., `Account.Industry`)
- Required slots show red asterisk
- Optional slots (e.g., Series) show "(optional)" label

**WHERE Conditions (optional)**
- Header: "WHERE" with an "Add Condition" button
- Each condition row:
  - `lightning-combobox` for field (from described fields, or custom text input)
  - `lightning-combobox` for operator: `=`, `!=`, `>`, `<`, `>=`, `<=`, `LIKE`, `IN`, `NOT IN`
  - `lightning-input` for value (text)
  - `lightning-button-icon` (x) to remove the row
- No OR support -- all conditions are ANDed
- Empty value on a condition row triggers inline validation error

**ORDER BY (conditional)**
- Visible only when profile `showOrderBy` is true
- `lightning-combobox` for field + `lightning-combobox` for direction (ASC, DESC)
- Optional -- can be left unset

**LIMIT (conditional)**
- Visible only when profile `showLimit` is true
- `lightning-input` type number, min 1
- Optional -- can be left unset

**SOQL Preview**
- Always visible at the bottom in both builder and raw modes
- Read-only `div` with monospace font
- Shows the fully assembled SOQL query with line breaks per clause
- Syntax-highlighted keywords (SELECT, FROM, WHERE, GROUP BY, ORDER BY, LIMIT) in bold

### 6.2 Raw Mode

When toggled to raw mode:
- All builder sections above (object, fields, WHERE, etc.) are hidden
- A `lightning-textarea` appears with the current SOQL string, fully editable
- The SOQL preview section remains visible below
- The `querychange` event fires on every keystroke (debounced 300ms)

## 7. Apex Controller -- SoqlBuilderController

```apex
public with sharing class SoqlBuilderController {

    @AuraEnabled(cacheable=true)
    public static List<ObjectOption> findObjects(String searchTerm) {
        // Schema.getGlobalDescribe(), filter by searchTerm (case-insensitive contains),
        // filter to isQueryable(), cap at 20 results, sort by label
    }

    @AuraEnabled(cacheable=true)
    public static List<FieldOption> describeFields(String objectName) {
        // Schema.getGlobalDescribe().get(objectName).getDescribe().fields.getMap()
        // Filter to isAccessible(), sort by label
        // Include referenceTo for lookup fields
    }

    public class ObjectOption {
        @AuraEnabled public String apiName;
        @AuraEnabled public String label;
        @AuraEnabled public Boolean isCustom;
    }

    public class FieldOption {
        @AuraEnabled public String apiName;
        @AuraEnabled public String label;
        @AuraEnabled public String fieldType;
        @AuraEnabled public String referenceTo;  // null if not a lookup
    }
}
```

**Error handling:**
- `findObjects` with null/blank searchTerm returns empty list (no exception)
- `describeFields` with invalid object name throws `AuraHandledException('Object not found: <name>')`

## 8. SOQL Parser (soqlParser.js)

Client-side module for parsing raw SOQL strings into builder state. Used when:
- A saved config is loaded (the `query` API property is set)
- Admin toggles from raw mode back to builder mode

### 8.1 Parse Function Signature

```js
export function parseSoql(soqlString) {
    return {
        success: Boolean,       // true if fully parsed, false if unsupported features found
        state: {
            objectName: String,
            fields: [{ fieldName, aggregate, alias }],
            recordContextField: String | null,
            whereConditions: [{ fieldName, operator, value }],
            orderByField: String | null,
            orderByDirection: String,  // 'ASC' or 'DESC'
            queryLimit: Number | null
        },
        warnings: [String]      // human-readable descriptions of dropped features
    };
}
```

### 8.2 Parse Strategy

1. **Clause extraction** -- Case-insensitive regex split on clause keywords. Extract raw strings for SELECT, FROM, WHERE, GROUP BY, ORDER BY, LIMIT.

2. **FROM** -- Single token after `FROM`, before next keyword. Trim whitespace.

3. **SELECT** -- Split by comma. Per token:
   - Regex: `/^\s*(SUM|COUNT|AVG|MIN|MAX)\(\s*([\w.]+)\s*\)\s+(\w+)\s*$/i` -- aggregate with alias
   - Regex: `/^\s*(SUM|COUNT|AVG|MIN|MAX)\(\s*([\w.]+)\s*\)\s*$/i` -- aggregate without alias (auto-generate alias)
   - Fallback: bare field name (label field)

4. **WHERE** -- Split by top-level `AND` (not inside parentheses). Per condition:
   - Check for `:recordId` -- extract field name into `recordContextField`
   - Otherwise regex: `/^\s*([\w.]+)\s*(=|!=|>=|<=|>|<|LIKE|NOT\s+IN|IN)\s*(.+)\s*$/i`
   - Value is the raw remainder (may include quotes, parentheses for IN lists)

5. **GROUP BY** -- Split by comma. Used for validation only (builder auto-manages GROUP BY).

6. **ORDER BY** -- Regex: `/^\s*([\w.]+)\s*(ASC|DESC)?\s*$/i`

7. **LIMIT** -- `parseInt()` on the token.

### 8.3 Unparseable Features (trigger `success: false`)

- Subqueries: `(SELECT` detected in query
- OR conditions: `OR` keyword in WHERE clause
- HAVING clauses
- TYPEOF expressions
- Nested parentheses in WHERE (beyond IN lists)
- Function calls: `FORMAT(`, `toLabel(`, `convertCurrency(`
- Multiple FROM objects
- OFFSET clause

When `success` is false, `state` still contains whatever was successfully parsed. `warnings` lists each unsupported feature found.

### 8.4 Toggle Flow

**Builder to Raw:**
- Serialize current builder state to SOQL string
- Populate textarea with that string
- No data loss -- the string is always generated from builder state

**Raw to Builder:**
1. Call `parseSoql(rawQuery)`
2. If `success === true`: apply `state` to builder, switch to builder mode
3. If `success === false`: show warning modal listing `warnings`
   - "Switch anyway" button: apply partial `state`, switch to builder mode (unsupported parts are dropped)
   - "Stay in raw mode" button: dismiss modal, remain in raw mode

## 9. SOQL Serializer

Generates a SOQL string from builder state. Called on every state change to update the preview and emit the `querychange` event. Lives in `soqlParser.js` alongside `parseSoql` as a named export.

```js
// In soqlParser.js
export function buildSoql(state, profile) {
    // Returns null if validation fails (required fields missing)
    // Returns SOQL string if valid
    // profile is the active BUILDER_PROFILES entry -- needed for autoGroupBy
}
```

**Assembly order:**
1. `SELECT` -- iterate field slots, format as `AGGREGATE(field) alias` or bare `field`
2. `FROM` -- object name
3. `WHERE` -- record context field as `field = :recordId` first, then AND-joined conditions
4. `GROUP BY` -- auto-computed from non-aggregate fields (if profile has autoGroupBy)
5. `ORDER BY` -- field + direction (if set)
6. `LIMIT` -- number (if set)

**Validation before emission:**
- `objectName` must be non-empty
- All required slots must have a `fieldName`
- All value slots must have an `aggregate`
- WHERE condition values cannot be empty (rows with empty values are excluded from the query but show inline errors)
- If validation fails, emit empty string for `value` in the `querychange` event

## 10. Auto-Population of Chart Config Fields

The `querychange` event includes resolved field identifiers for each chart config field:

| Builder Slot Key | Event Detail Property | Resolved Value |
|---|---|---|
| `label` | `labelField` | The field's API name (e.g., `StageName`) |
| `value` | `valueField` | The alias (e.g., `total`) |
| `series` | `seriesField` | The field's API name (e.g., `Product2.Family`) |
| `secondaryValue` | `secondaryValueField` | The alias (e.g., `avg_score`) |

Slots not present in the active profile emit `null` for their corresponding property.

The configurator applies these values to the column config, overwriting the current `labelField`, `valueField`, etc. The admin can still manually edit these config fields in the inputs below the builder -- manual edits are not overwritten until the next `querychange` event fires.

## 11. Styling

The builder lives inside the existing `.column-detail` container. New CSS classes scoped to `soqlQueryBuilder`:

- `.builder-section` -- vertical stack with `0.75rem` gap between sections
- `.mode-toggle` -- right-aligned at top of builder
- `.object-search` -- relative positioned for dropdown
- `.object-dropdown` -- absolute positioned dropdown, max-height 200px, overflow-y auto, z-index 10, border + shadow
- `.object-option` -- hover highlight, click to select
- `.field-slot-row` -- flex row with label, aggregate picker (if applicable), field picker, alias text
- `.where-row` -- flex row with field, operator, value, remove button
- `.soql-preview` -- monospace font, light gray background, padding, rounded border, white-space pre-wrap
- `.soql-keyword` -- bold text for SQL keywords in preview

Follows SLDS design tokens for colors, borders, spacing. No custom colors.

## 12. Edge Cases

1. **Empty query on load** -- Builder starts with no object selected, all slots empty. Preview shows nothing.
2. **Saved config with raw query** -- On load, parser attempts to parse. If successful, builder mode is active. If not, falls back to raw mode automatically with warnings shown once.
3. **Chart type changes** -- Builder resets slots to new profile. Object, record context, and WHERE conditions are preserved. ORDER BY and LIMIT are cleared if the new profile hides them.
4. **Object change** -- All field selections are cleared (they may not exist on the new object). Record context field is cleared. WHERE conditions are cleared.
5. **Field not in describe results** -- When loading a saved query, a field may not appear in the describe results (e.g., a relationship field). The combobox shows the raw API name as the selected value even if it's not in the options list. This allows dot-notation fields to persist.
6. **Concurrent describe calls** -- If the admin types quickly and triggers multiple `describeFields` calls, only the most recent result is applied (track a request counter or use the @wire adapter's built-in deduplication).

## 13. Testing

### 13.1 Apex Tests (SoqlBuilderControllerTest)

| Test | Description |
|---|---|
| `testFindObjectsWithKnownObject` | Search for "Account", verify it appears in results |
| `testFindObjectsWithCustomObject` | Search for "Chart_Buddy", verify custom object flagged |
| `testFindObjectsEmptySearch` | Blank search term returns empty list |
| `testFindObjectsNoResults` | Gibberish search returns empty list |
| `testFindObjectsCapsAt20` | Verify result cap |
| `testDescribeFieldsAccount` | Describe Account, verify Name, Industry, etc. appear |
| `testDescribeFieldsFLSRespected` | Fields the running user can't access are excluded |
| `testDescribeFieldsInvalidObject` | Invalid object name throws AuraHandledException |
| `testDescribeFieldsReferenceInfo` | Lookup fields include referenceTo value |

Target: 90%+ coverage.

### 13.2 Client-Side Parser Tests (manual verification)

| Input | Expected |
|---|---|
| `SELECT StageName, SUM(Amount) total FROM Opportunity WHERE AccountId = :recordId GROUP BY StageName` | Full parse, success=true, recordContextField=AccountId |
| `SELECT COUNT(Id) cnt FROM Case WHERE Status = 'Open'` | success=true, no record context |
| `SELECT Name FROM Account WHERE Id IN (SELECT AccountId FROM Opportunity)` | success=false, warning about subquery |
| `SELECT Name FROM Account WHERE Type = 'Customer' OR Type = 'Partner'` | success=false, warning about OR |
| Empty string | success=true, empty state |
