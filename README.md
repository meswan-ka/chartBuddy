# chartBuddy

SLDS 2 chart components for Salesforce Lightning. Seven SVG-based LWCs that replicate Lightning Design System chart patterns with composable SOQL data sources and locale-aware currency formatting.

Drop any chart onto a Record Page or App Page, point it at a query, and it renders -- no code required.

---

## Components

| Component | Type | Use Case |
|-----------|------|----------|
| `c-bar-chart` | Bar / Column | Compare nominal or ordinal values across categories |
| `c-line-chart` | Line / Area | Trend data over time, single or dual-axis |
| `c-flat-gauge` | Flat Gauge | Progress toward a metric in tight spaces |
| `c-polar-gauge` | Polar Gauge | Circular progress toward a goal |
| `c-ratings-chart` | Ratings | Dot-based rating out of a configurable maximum |
| `c-pipeline-chart` | Origami / Funnel | Pipeline stage breakdown with descending trapezoids |
| `c-waterfall-chart` | Waterfall | Stage-by-stage changes showing increases and decreases |

---

## Installation

### Prerequisites

- Salesforce CLI (`sf`) installed
- An authorized Salesforce org (scratch or sandbox)

### Deploy

```bash
git clone https://github.com/meswan-ka/chartBuddy.git
cd chartBuddy
sf project deploy start --source-dir force-app --target-org <your-org-alias>
```

### Run Tests

```bash
sf apex run test --class-names ChartQueryControllerTest --target-org <your-org-alias> --wait 5
```

---

## Quick Start

1. Deploy to your org
2. Open a Record Page in Lightning App Builder
3. Drag any chart component onto the page
4. Configure the **SOQL Query** property with `:recordId` as the bind variable
5. Set **Label Field** and **Value Field** to match your query's output columns
6. Save and activate

### Example: Opportunity Pipeline on Account Page

Drop `c-bar-chart` onto the Account record page with:

| Property | Value |
|----------|-------|
| Chart Title | Opportunities by Stage |
| SOQL Query | `SELECT StageName, SUM(Amount) total FROM Opportunity WHERE AccountId = :recordId GROUP BY StageName` |
| Label Field | `StageName` |
| Value Field | `total` |
| Value Prefix | `$` |
| Orientation | `vertical` |

---

## Data Source Architecture

All charts use a shared Apex controller (`ChartQueryController`) that executes SOQL at runtime with the current record's ID bound in.

### Apex Methods

| Method | Returns | Used By |
|--------|---------|---------|
| `executeQuery(query, recordId)` | `List<ChartDataPoint>` | pipelineChart, waterfallChart |
| `executeRawQuery(query, recordId)` | `List<Map<String, Object>>` | barChart, lineChart |
| `executeSingleValueQuery(query, recordId)` | `Double` | flatGauge, polarGauge, ratingsChart |

### Query Binding

Use `:recordId` in your SOQL. The controller replaces it with the actual record ID at execution time. Queries are validated server-side: only `SELECT` statements are allowed, and DML keywords are rejected.

```sql
-- Aggregate query (barChart, lineChart)
SELECT StageName, COUNT(Id) cnt
FROM Opportunity
WHERE AccountId = :recordId
GROUP BY StageName

-- Single-value query (flatGauge, polarGauge)
SELECT SUM(Amount) total
FROM Opportunity
WHERE AccountId = :recordId
```

### Security

- Runs with `with sharing` -- respects the running user's record access
- Input sanitized against DML injection (`INSERT`, `UPDATE`, `DELETE`, `UPSERT`, `MERGE` rejected)
- Only `SELECT` queries pass validation
- Record IDs are escaped via `String.escapeSingleQuotes`

---

## Locale-Aware Currency

When `Value Prefix` is set to `$` (or any currency symbol, or the keyword `currency` / `auto`), the component automatically detects the running user's locale and org currency via `@salesforce/i18n/locale` and `@salesforce/i18n/currency`, then renders the correct symbol using `Intl.NumberFormat`.

| Org Currency | User Locale | Rendered |
|-------------|-------------|----------|
| USD | en-US | `$10M` |
| EUR | de-DE | `10M` (euro sign) |
| GBP | en-GB | `10M` (pound sign) |
| JPY | ja-JP | `10M` (yen sign) |

No per-user configuration needed. Set `$` once in App Builder and it works globally.

---

## Component Reference

### c-bar-chart

Horizontal bars or vertical columns. Supports simple, stacked, and grouped variants for multi-series data.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `chartTitle` | String | | Title displayed below the chart |
| `query` | String | | SOQL query with `:recordId` binding |
| `labelField` | String | | Field name for category axis labels |
| `valueField` | String | | Field name for numeric values |
| `seriesField` | String | | Field name for series grouping (enables stacked/grouped) |
| `orientation` | String | `vertical` | `vertical` (columns) or `horizontal` (bars) |
| `variant` | String | `simple` | `simple`, `stacked`, or `grouped` |
| `valuePrefix` | String | | Value prefix (`$`, `currency`, or literal text) |
| `valueSuffix` | String | | Value suffix (`M`, `%`, etc.) |
| `height` | Integer | `300` | Chart height in pixels |

**Stacked/Grouped**: Set `seriesField` to a grouping field. The query must return rows with label, series, and value columns:

```sql
SELECT Account.Industry, Product2.Family prodFamily, SUM(Amount) total
FROM OpportunityLineItem
WHERE OpportunityId IN (SELECT Id FROM Opportunity WHERE AccountId = :recordId)
GROUP BY Account.Industry, Product2.Family
```

---

### c-line-chart

Single or dual-axis line chart with optional area fill beneath the lines.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `chartTitle` | String | | Title below the chart |
| `query` | String | | SOQL query with `:recordId` |
| `labelField` | String | | Field for X-axis labels |
| `valueField` | String | | Primary Y-axis value field |
| `secondaryValueField` | String | | Secondary Y-axis value field (enables dual axis) |
| `showArea` | Boolean | `true` | Fill area under the lines |
| `valuePrefix` | String | | Primary axis prefix |
| `valueSuffix` | String | | Primary axis suffix |
| `secondaryPrefix` | String | | Secondary axis prefix |
| `secondarySuffix` | String | | Secondary axis suffix |
| `height` | Integer | `300` | Chart height in pixels |

**Dual Axis**: Set `secondaryValueField` to a second numeric column from the same query. The chart renders independent Y-axis scales on left and right.

```sql
SELECT CloseDate, SUM(Amount) sales, COUNT(Id) oppCount
FROM Opportunity
WHERE AccountId = :recordId
GROUP BY CloseDate
ORDER BY CloseDate
```

---

### c-flat-gauge

Horizontal rounded-pill gauge showing progress toward a target. Supports an optional reference line (e.g., average marker).

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `chartTitle` | String | | Label above the gauge |
| `query` | String | | SOQL returning a single numeric value |
| `maxValue` | Decimal | `100` | Target/maximum value (full bar width) |
| `referenceValue` | Decimal | | Position of reference marker line |
| `referenceLabel` | String | `Avg` | Label for the reference marker |
| `valuePrefix` | String | | Value display prefix |
| `valueSuffix` | String | | Value display suffix |

**Example**: Quota attainment with average marker:

```
Query: SELECT SUM(Amount) FROM Opportunity WHERE AccountId = :recordId AND IsWon = true
Max Value: 500000
Reference Value: 350000
Reference Label: Avg
Value Prefix: $
```

---

### c-polar-gauge

Circular donut-arc gauge showing percentage progress. The arc spans 240 degrees with rounded endpoints.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `chartTitle` | String | | Caption below the gauge |
| `query` | String | | SOQL returning a single numeric value |
| `maxValue` | Decimal | `100` | Value representing 100% (full arc) |
| `valueSuffix` | String | `%` | Suffix displayed after the center value |

---

### c-ratings-chart

Row of filled and unfilled circles representing a rating score.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `chartTitle` | String | | Caption below the dots |
| `query` | String | | SOQL returning a single numeric value |
| `maxDots` | Integer | `10` | Total number of dots |

The query result is rounded to determine how many dots are filled (blue). Remaining dots render as gray.

---

### c-pipeline-chart

Origami-style horizontal funnel with descending trapezoid shapes. Colors interpolate from dark blue to green across stages.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `chartTitle` | String | | Caption below the chart |
| `query` | String | | SOQL returning label + value pairs |
| `valuePrefix` | String | `$` | Prefix for in-shape value labels |
| `valueSuffix` | String | `m` | Suffix for in-shape value labels |

**Example**: Sales pipeline by stage:

```sql
SELECT StageName, SUM(Amount) total
FROM Opportunity
WHERE AccountId = :recordId
GROUP BY StageName
ORDER BY SUM(Amount) DESC
```

Stage names appear above each trapezoid. Dollar values render centered inside each shape in white.

---

### c-waterfall-chart

Floating bar chart showing how values change across stages. Start and end bars anchor at zero (blue); intermediate bars float to show increases (green) and decreases (red). Dashed connector lines bridge between bars.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `chartTitle` | String | | Caption below the chart |
| `query` | String | | SOQL returning label + value pairs |
| `mode` | String | `delta` | `delta` (raw changes) or `cumulative` (running totals) |
| `valuePrefix` | String | `$` | Y-axis value prefix |
| `valueSuffix` | String | | Y-axis value suffix |
| `height` | Integer | `300` | Chart height in pixels |

**Delta mode**: First and last rows are anchor totals. Middle rows are positive/negative deltas.

**Cumulative mode**: Each row is a running total. The component computes deltas between consecutive values.

---

## Shared Utilities

`chartUtils` is a service module imported by all chart components. It provides:

| Export | Purpose |
|--------|---------|
| `CHART_COLORS` | 12-color SLDS-aligned palette |
| `SERIES_COLORS` | 3-color palette for multi-series (blue, purple, pink) |
| `PIPELINE_COLORS` | 6-color gradient for origami charts (dark blue to green) |
| `COLORS` | Semantic color map (primary, positive, negative, grid, axis, etc.) |
| `formatValue(value, options)` | Abbreviate numbers: `150000` becomes `$150K` |
| `computeTicks(maxValue, count)` | Generate "nice" axis tick values (rounded intervals) |
| `groupSeriesData(results, ...)` | Pivot raw query rows into a label/series matrix |
| `isCurrencyPrefix(prefix)` | Detect if a prefix should trigger locale currency resolution |
| `getCurrencySymbol(locale, code)` | Extract narrow currency symbol via `Intl.NumberFormat` |
| `describeArc(cx, cy, r, start, end)` | Generate SVG arc path data for polar gauges |
| `clamp(value, min, max)` | Constrain a value to a range |

---

## Project Structure

```
chartBuddy/
  sfdx-project.json
  .forceignore
  force-app/main/default/
    objects/
      Chart_Buddy_Config__c/            Config storage object
        fields/
          Config_JSON__c                131KB JSON config field
          Description__c                Config description
    classes/
      ChartQueryController              Query executor (3 methods)
      ChartBuddyConfigController        Config CRUD
      ChartBuddyConfigPicklist          App Builder datasource
      *Test classes*
    lwc/
      chartUtils/                       Shared colors, formatting, math
      chartBuddyConfigurator/           Builder UI (admin tool)
      chartBuddyContainer/             Runtime dashboard container
      barChart/                         Bar / Column chart
      lineChart/                        Line / Area chart
      flatGauge/                        Horizontal gauge
      polarGauge/                       Circular gauge
      ratingsChart/                     Dot-based rating
      pipelineChart/                    Origami funnel
      waterfallChart/                   Waterfall chart
```

---

## Design Decisions

- **Pure SVG, no external libraries**: No Chart.js, D3, or static resources. Components render SVG directly in LWC templates using `for:each` iteration and computed getters. Zero CSP concerns.
- **Template-driven rendering**: All SVG element positions are computed via JS getters and bound in the template. No `lwc:dom="manual"` or imperative DOM manipulation.
- **Composable queries over hardcoded data**: Every chart accepts a SOQL string as a design attribute. Admins wire up data without writing code.
- **Locale-aware currency**: `@salesforce/i18n/currency` + `Intl.NumberFormat` resolves the correct symbol per user. No per-locale configuration.
- **Single Apex controller**: Three methods cover all chart data patterns (aggregate, raw, single-value). `with sharing` enforced.

---

## Dashboard Container

### Overview

The **chartBuddyContainer** and **chartBuddyConfigurator** components let admins build multi-chart dashboards without code. Configure up to 12 chart columns side-by-side, each with its own chart type, query, and settings.

### How It Works

1. Drop `c-chart-buddy-configurator` onto an App Page
2. Create a new config: name it, set a dashboard title
3. Add columns -- pick chart type, set width (1-12 grid columns), configure the query and chart-specific settings
4. Save the config
5. Drop `c-chart-buddy-container` onto any Record Page or App Page
6. Select the saved config from the picklist
7. The container renders all configured charts in a responsive grid

### Configurator (Builder)

Two-panel layout:

| Panel | Purpose |
|-------|---------|
| Left (60%) | Config management, column add/remove/reorder, chart type selection, per-type settings |
| Right (40%) | Visual grid preview showing column widths and chart types |

**Column operations:**
- Add Column (up to 12)
- Remove Column
- Move Up / Move Down (reorder)
- Expand/collapse each column's settings
- Chart type selector (all 7 types)
- Width selector (1-12 grid units)
- Chart-specific config fields rendered dynamically based on type

**Config persistence:**
- Configs stored in `Chart_Buddy_Config__c` custom object
- Full dashboard JSON serialized to `Config_JSON__c` (131KB LongTextArea)
- Save / Load / Clone / Delete operations
- `ChartBuddyConfigPicklist` provides App Builder datasource

### Container (Runtime)

| Property | Type | Description |
|----------|------|-------------|
| `configName` | String | Name of saved config (picklist in App Builder) |
| `recordId` | String | Auto-injected on record pages, passed to all child charts |

The container:
1. Loads the named config from `Chart_Buddy_Config__c`
2. Parses the JSON into column definitions
3. Renders a `lightning-layout` with one `lightning-layout-item` per column
4. Each item dynamically renders the correct chart component with all configured props
5. `recordId` is forwarded to every child chart for `:recordId` query binding

### Config JSON Structure

```json
{
  "containerTitle": "Account Analytics Dashboard",
  "columns": [
    {
      "id": "col-1",
      "chartType": "barChart",
      "width": 6,
      "config": {
        "chartTitle": "Opportunities by Stage",
        "query": "SELECT StageName, SUM(Amount) total FROM Opportunity WHERE AccountId = :recordId GROUP BY StageName",
        "labelField": "StageName",
        "valueField": "total",
        "orientation": "vertical",
        "variant": "simple",
        "valuePrefix": "$",
        "valueSuffix": "",
        "height": 300
      }
    },
    {
      "id": "col-2",
      "chartType": "polarGauge",
      "width": 3,
      "config": {
        "chartTitle": "Win Rate",
        "query": "SELECT (COUNT(CASE WHEN IsWon = true THEN Id END) * 100 / COUNT(Id)) rate FROM Opportunity WHERE AccountId = :recordId",
        "maxValue": 100,
        "valueSuffix": "%"
      }
    },
    {
      "id": "col-3",
      "chartType": "flatGauge",
      "width": 3,
      "config": {
        "chartTitle": "Quota Attainment",
        "query": "SELECT SUM(Amount) FROM Opportunity WHERE AccountId = :recordId AND IsWon = true",
        "maxValue": 500000,
        "referenceValue": 350000,
        "referenceLabel": "Avg",
        "valuePrefix": "$",
        "valueSuffix": ""
      }
    }
  ]
}
```

### Example: Three-Column Account Dashboard

| Column | Width | Chart Type | Shows |
|--------|-------|------------|-------|
| 1 | 6/12 | Bar Chart | Opportunities by stage |
| 2 | 3/12 | Polar Gauge | Win rate percentage |
| 3 | 3/12 | Flat Gauge | Quota attainment with average reference |

---

## Targets

All components are exposed to:

- `lightning__RecordPage` -- `recordId` is auto-injected by the platform
- `lightning__AppPage` -- queries that reference `:recordId` will not resolve (use non-record-bound queries on App Pages)

---

## API Version

All metadata targets Salesforce API version **63.0**.

---

## License

MIT
