@IsTest
private class SoqlBuilderControllerTest {
    @IsTest
    static void testFindObjectsWithKnownObject() {
        List<SoqlBuilderController.ObjectOption> results = SoqlBuilderController.findObjects('Account');
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
        List<SoqlBuilderController.ObjectOption> results = SoqlBuilderController.findObjects('Chart_Buddy');
        for (SoqlBuilderController.ObjectOption opt : results) {
            if (opt.apiName == 'Chart_Buddy_Config__c') {
                System.assertEquals(true, opt.isCustom);
            }
        }
        System.assert(true);
    }

    @IsTest
    static void testFindObjectsEmptySearch() {
        List<SoqlBuilderController.ObjectOption> results = SoqlBuilderController.findObjects('');
        System.assertEquals(0, results.size(), 'Empty search should return no results');
    }

    @IsTest
    static void testFindObjectsNullSearch() {
        List<SoqlBuilderController.ObjectOption> results = SoqlBuilderController.findObjects(null);
        System.assertEquals(0, results.size(), 'Null search should return no results');
    }

    @IsTest
    static void testFindObjectsShortSearch() {
        List<SoqlBuilderController.ObjectOption> results = SoqlBuilderController.findObjects('A');
        System.assertEquals(0, results.size(), 'Single char search should return no results');
    }

    @IsTest
    static void testFindObjectsNoResults() {
        List<SoqlBuilderController.ObjectOption> results = SoqlBuilderController.findObjects('zzzzxyzzyNotAnObject');
        System.assertEquals(0, results.size(), 'Gibberish search should return no results');
    }

    @IsTest
    static void testFindObjectsCapsAt20() {
        List<SoqlBuilderController.ObjectOption> results = SoqlBuilderController.findObjects('__');
        System.assert(results.size() <= 20, 'Results should be capped at 20');
    }

    @IsTest
    static void testDescribeFieldsAccount() {
        List<SoqlBuilderController.FieldOption> results = SoqlBuilderController.describeFields('Account');
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
        List<SoqlBuilderController.FieldOption> results = SoqlBuilderController.describeFields('Contact');
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
            System.assert(
                e.getMessage().contains('Object not found'),
                'Error message should indicate object not found'
            );
        }
    }

    @IsTest
    static void testDescribeFieldsBlankObject() {
        try {
            SoqlBuilderController.describeFields('');
            System.assert(false, 'Should have thrown AuraHandledException');
        } catch (AuraHandledException e) {
            System.assert(e.getMessage().contains('required'), 'Error message should indicate object name is required');
        }
    }

    @IsTest
    static void testDescribeFieldsSorted() {
        List<SoqlBuilderController.FieldOption> results = SoqlBuilderController.describeFields('Account');
        for (Integer i = 1; i < results.size(); i++) {
            System.assert(
                results[i - 1].label.compareTo(results[i].label) <= 0,
                'Fields should be sorted by label: ' + results[i - 1].label + ' vs ' + results[i].label
            );
        }
    }

    @IsTest
    static void testFindObjectsSorted() {
        List<SoqlBuilderController.ObjectOption> results = SoqlBuilderController.findObjects('Acc');
        for (Integer i = 1; i < results.size(); i++) {
            System.assert(results[i - 1].label.compareTo(results[i].label) <= 0, 'Objects should be sorted by label');
        }
    }
}
