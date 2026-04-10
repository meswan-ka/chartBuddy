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

    // Build a mask that replaces single-quoted strings with same-length placeholders
    // so clause keywords inside string literals are not matched
    const masked = normalized.replace(/'[^']*'/g, match => '_'.repeat(match.length));

    const clausePattern = /\b(SELECT|FROM|WHERE|GROUP\s+BY|ORDER\s+BY|LIMIT)\b/gi;
    const matches = [];
    let match;
    while ((match = clausePattern.exec(masked)) !== null) {
        matches.push({ keyword: match[1].toUpperCase().replace(/\s+/g, ' '), index: match.index });
    }

    for (let i = 0; i < matches.length; i++) {
        const start = matches[i].index + matches[i].keyword.length;
        const end = i + 1 < matches.length ? matches[i + 1].index : normalized.length;
        // Extract from the ORIGINAL string (not masked) to preserve actual values
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

    const slotFields = state.fields || [];

    // Must have at least one field with a name
    const populatedFields = slotFields.filter(f => f && f.fieldName);
    if (populatedFields.length === 0) return null;

    // Single-mode gauges require the first field to have an aggregate
    if (profile.mode === 'single') {
        const first = slotFields[0];
        if (!first || !first.fieldName || !first.aggregate) return null;
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

    // ORDER BY - use alias if the field is aggregated
    if (profile.showOrderBy && state.orderByField) {
        let orderField = state.orderByField;
        for (const field of slotFields) {
            if (field && field.fieldName === orderField && field.aggregate && field.alias) {
                orderField = field.alias;
                break;
            }
        }
        soql += '\nORDER BY ' + orderField + ' ' + (state.orderByDirection || 'ASC');
    }

    // LIMIT
    if (profile.showLimit && state.queryLimit) {
        soql += '\nLIMIT ' + state.queryLimit;
    }

    return soql;
}
