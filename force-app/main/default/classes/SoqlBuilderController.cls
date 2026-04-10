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
