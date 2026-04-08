public with sharing class ChartQueryController {
    @AuraEnabled(cacheable=true)
    public static List<ChartDataPoint> executeQuery(String query, String recordId) {
        if (String.isBlank(query)) {
            throw new AuraHandledException('Query is required');
        }
        String sanitized = sanitizeQuery(query);
        String bound = sanitized.replace(':recordId', '\'' + String.escapeSingleQuotes(recordId) + '\'');
        List<AggregateResult> results = Database.query(bound);
        List<ChartDataPoint> points = new List<ChartDataPoint>();
        for (AggregateResult ar : results) {
            Map<String, Object> fields = ar.getPopulatedFieldsAsMap();
            ChartDataPoint dp = new ChartDataPoint();
            for (String key : fields.keySet()) {
                Object val = fields.get(key);
                if (val instanceof Decimal || val instanceof Integer || val instanceof Long || val instanceof Double) {
                    dp.value = ((Decimal) val).doubleValue();
                    dp.valueField = key;
                } else {
                    dp.label = String.valueOf(val);
                    dp.labelField = key;
                }
            }
            points.add(dp);
        }
        return points;
    }

    @AuraEnabled(cacheable=true)
    public static List<Map<String, Object>> executeRawQuery(String query, String recordId) {
        if (String.isBlank(query)) {
            throw new AuraHandledException('Query is required');
        }
        String sanitized = sanitizeQuery(query);
        String bound = sanitized.replace(':recordId', '\'' + String.escapeSingleQuotes(recordId) + '\'');
        List<SObject> results = Database.query(bound);
        List<Map<String, Object>> rows = new List<Map<String, Object>>();
        for (SObject rec : results) {
            rows.add(rec.getPopulatedFieldsAsMap());
        }
        return rows;
    }

    @AuraEnabled(cacheable=true)
    public static Double executeSingleValueQuery(String query, String recordId) {
        if (String.isBlank(query)) {
            throw new AuraHandledException('Query is required');
        }
        String sanitized = sanitizeQuery(query);
        String bound = sanitized.replace(':recordId', '\'' + String.escapeSingleQuotes(recordId) + '\'');
        List<AggregateResult> results = Database.query(bound);
        if (results.isEmpty()) {
            return 0;
        }
        Map<String, Object> fields = results[0].getPopulatedFieldsAsMap();
        for (String key : fields.keySet()) {
            Object val = fields.get(key);
            if (val instanceof Decimal) {
                return ((Decimal) val).doubleValue();
            }
            if (val instanceof Integer) {
                return Double.valueOf((Integer) val);
            }
            if (val instanceof Long) {
                return Double.valueOf((Long) val);
            }
        }
        return 0;
    }

    private static String sanitizeQuery(String query) {
        String upper = query.toUpperCase().trim();
        if (!upper.startsWith('SELECT')) {
            throw new AuraHandledException('Only SELECT queries are allowed');
        }
        if (
            upper.contains('INSERT') ||
            upper.contains('UPDATE') ||
            upper.contains('DELETE') ||
            upper.contains('UPSERT') ||
            upper.contains('MERGE')
        ) {
            throw new AuraHandledException('DML operations are not allowed in queries');
        }
        return query;
    }

    public class ChartDataPoint {
        @AuraEnabled
        public String label;
        @AuraEnabled
        public Double value;
        @AuraEnabled
        public String labelField;
        @AuraEnabled
        public String valueField;
    }
}
