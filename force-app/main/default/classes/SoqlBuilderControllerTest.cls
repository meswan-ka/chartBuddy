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
    static void testFindObjectsMatchesLabel() {
        List<SoqlBuilderController.ObjectOption> results = SoqlBuilderController.findObjects('Contact');
        System.assert(results.size() > 0, 'Should find objects matching "Contact"');
        Boolean foundContact = false;
        for (SoqlBuilderController.ObjectOption opt : results) {
            if (opt.apiName == 'Contact') {
                foundContact = true;
                break;
            }
        }
        System.assert(foundContact, 'Contact should appear when searching "Contact"');
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
        Boolean exceptionThrown = false;
        try {
            SoqlBuilderController.describeFields('NotARealObject__c');
        } catch (AuraHandledException e) {
            exceptionThrown = true;
        }
        System.assert(exceptionThrown, 'Should have thrown AuraHandledException for invalid object');
    }

    @IsTest
    static void testDescribeFieldsBlankObject() {
        Boolean exceptionThrown = false;
        try {
            SoqlBuilderController.describeFields('');
        } catch (AuraHandledException e) {
            exceptionThrown = true;
        }
        System.assert(exceptionThrown, 'Should have thrown AuraHandledException for blank object name');
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
