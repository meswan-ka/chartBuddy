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
            Schema.SObjectType sot = globalDescribe.get(apiName);
            if (sot == null) {
                continue;
            }
            Schema.DescribeSObjectResult objDesc = sot.getDescribe();
            if (!objDesc.isQueryable()) {
                continue;
            }
            String lowerApi = apiName.toLowerCase();
            String lowerLabel = objDesc.getLabel().toLowerCase();
            if (lowerApi.contains(term) || lowerLabel.contains(term)) {
                ObjectOption opt = new ObjectOption();
                opt.apiName = objDesc.getName();
                opt.label = objDesc.getLabel();
                opt.isCustom = objDesc.isCustom();
                results.add(opt);
            }
        }
        results.sort();
        while (results.size() > 20) {
            results.remove(results.size() - 1);
        }
        return results;
    }

    @AuraEnabled(cacheable=true)
    public static List<FieldOption> describeFields(String objectName) {
        if (String.isBlank(objectName)) {
            throw new AuraHandledException('Object name is required');
        }
        List<Schema.DescribeSObjectResult> describes;
        try {
            describes = Schema.describeSObjects(new List<String>{ objectName });
        } catch (Exception e) {
            throw new AuraHandledException('Object not found: ' + objectName);
        }
        Map<String, Schema.SObjectField> fieldMap = describes[0].fields.getMap();
        List<FieldOption> results = new List<FieldOption>();
        for (String fieldKey : fieldMap.keySet()) {
            Schema.SObjectField sof = fieldMap.get(fieldKey);
            if (sof == null) {
                continue;
            }
            Schema.DescribeFieldResult dfr = sof.getDescribe();
            if (!dfr.isAccessible()) {
                continue;
            }
            Schema.DisplayType dt = dfr.getType();
            if (dt == Schema.DisplayType.ADDRESS || dt == Schema.DisplayType.LOCATION) {
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
        @AuraEnabled
        public String apiName;
        @AuraEnabled
        public String label;
        @AuraEnabled
        public Boolean isCustom;

        public Integer compareTo(Object other) {
            String a = this.label != null ? this.label : '';
            String b = ((ObjectOption) other).label != null ? ((ObjectOption) other).label : '';
            return a.compareTo(b);
        }
    }

    public class FieldOption implements Comparable {
        @AuraEnabled
        public String apiName;
        @AuraEnabled
        public String label;
        @AuraEnabled
        public String fieldType;
        @AuraEnabled
        public String referenceTo;

        public Integer compareTo(Object other) {
            String a = this.label != null ? this.label : '';
            String b = ((FieldOption) other).label != null ? ((FieldOption) other).label : '';
            return a.compareTo(b);
        }
    }
}
