@IsTest
private class ChartQueryControllerTest {
    @TestSetup
    static void makeData() {
        Account acc = new Account(Name = 'Chart Test Account', Industry = 'Technology');
        insert acc;
        List<Opportunity> opps = new List<Opportunity>();
        for (Integer i = 0; i < 5; i++) {
            opps.add(
                new Opportunity(
                    Name = 'Opp ' + i,
                    AccountId = acc.Id,
                    StageName = (Math.mod(i, 2) == 0) ? 'Prospecting' : 'Qualification',
                    CloseDate = Date.today().addDays(30),
                    Amount = (i + 1) * 10000
                )
            );
        }
        insert opps;
    }

    @IsTest
    static void testExecuteQuery() {
        Account acc = [SELECT Id FROM Account LIMIT 1];
        String query = 'SELECT StageName label, COUNT(Id) cnt FROM Opportunity WHERE AccountId = :recordId GROUP BY StageName';
        List<ChartQueryController.ChartDataPoint> results = ChartQueryController.executeQuery(query, acc.Id);
        Assert.isFalse(results.isEmpty(), 'Should return aggregated results');
        for (ChartQueryController.ChartDataPoint dp : results) {
            Assert.isNotNull(dp.label, 'Label should be populated');
            Assert.isNotNull(dp.value, 'Value should be populated');
        }
    }

    @IsTest
    static void testExecuteRawQuery() {
        Account acc = [SELECT Id FROM Account LIMIT 1];
        String query = 'SELECT Id, Name, StageName, Amount FROM Opportunity WHERE AccountId = :recordId ORDER BY Amount';
        List<Map<String, Object>> results = ChartQueryController.executeRawQuery(query, acc.Id);
        Assert.areEqual(5, results.size(), 'Should return 5 opportunities');
    }

    @IsTest
    static void testExecuteSingleValueQuery() {
        Account acc = [SELECT Id FROM Account LIMIT 1];
        String query = 'SELECT SUM(Amount) total FROM Opportunity WHERE AccountId = :recordId';
        Double result = ChartQueryController.executeSingleValueQuery(query, acc.Id);
        Assert.areEqual(150000, result, 'Sum should be 150000');
    }

    @IsTest
    static void testExecuteQueryWithPicklistSort() {
        Account acc = [SELECT Id FROM Account LIMIT 1];
        String query = 'SELECT StageName label, COUNT(Id) cnt FROM Opportunity WHERE AccountId = :recordId GROUP BY StageName';
        List<ChartQueryController.ChartDataPoint> results = ChartQueryController.executeQueryWithPicklistSort(
            query,
            acc.Id,
            'Opportunity',
            'StageName'
        );
        Assert.isFalse(results.isEmpty(), 'Should return results');
        if (results.size() > 1) {
            Assert.areEqual('Prospecting', results[0].label, 'Prospecting should sort first');
        }
    }

    @IsTest
    static void testPicklistSortAutoDetectsFromQuery() {
        Account acc = [SELECT Id FROM Account LIMIT 1];
        String query = 'SELECT StageName label, COUNT(Id) cnt FROM Opportunity WHERE AccountId = :recordId GROUP BY StageName';
        List<ChartQueryController.ChartDataPoint> results = ChartQueryController.executeQueryWithPicklistSort(
            query,
            acc.Id,
            null,
            null
        );
        Assert.isFalse(results.isEmpty(), 'Should return results with auto-detected sort');
        if (results.size() > 1) {
            Assert.areEqual('Prospecting', results[0].label, 'Auto-detect should sort by picklist order');
        }
    }

    @IsTest
    static void testBlankQueryThrows() {
        Boolean threw = false;
        try {
            ChartQueryController.executeQuery('', 'fakeId');
        } catch (AuraHandledException e) {
            threw = true;
        }
        Assert.isTrue(threw, 'Should throw for blank query');
    }

    @IsTest
    static void testNonSelectThrows() {
        Boolean threw = false;
        try {
            ChartQueryController.executeQuery('DELETE FROM Account', 'fakeId');
        } catch (AuraHandledException e) {
            threw = true;
        }
        Assert.isTrue(threw, 'Should throw for non-SELECT query');
    }

    @IsTest
    static void testDmlKeywordsThrow() {
        Boolean threw = false;
        try {
            ChartQueryController.executeQuery('SELECT Id FROM Account WHERE Name = \'UPDATE\'', 'fakeId');
        } catch (AuraHandledException e) {
            threw = true;
        }
        Assert.isTrue(threw, 'Should throw for DML keywords');
    }

    @IsTest
    static void testSingleValueEmptyResult() {
        String query = 'SELECT COUNT(Id) cnt FROM Opportunity WHERE AccountId = :recordId';
        Double result = ChartQueryController.executeSingleValueQuery(query, '001000000000000AAA');
        Assert.isNotNull(result, 'Should return 0 for empty result');
    }
}
