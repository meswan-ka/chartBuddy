@IsTest
private class ChartBuddyConfigControllerTest {
    @TestSetup
    static void makeData() {
        Chart_Buddy_Config__c config = new Chart_Buddy_Config__c(
            Name = 'Test Dashboard',
            Description__c = 'Unit test config',
            Config_JSON__c = '{"containerTitle":"Test","columns":[]}'
        );
        insert config;
    }

    @IsTest
    static void testGetConfigs() {
        List<Chart_Buddy_Config__c> configs = ChartBuddyConfigController.getConfigs();
        Assert.isFalse(configs.isEmpty(), 'Should return at least one config');
        Assert.areEqual('Test Dashboard', configs[0].Name);
    }

    @IsTest
    static void testGetConfigByName() {
        Chart_Buddy_Config__c config = ChartBuddyConfigController.getConfigByName('Test Dashboard');
        Assert.areEqual('Unit test config', config.Description__c);
        Assert.isTrue(config.Config_JSON__c.contains('containerTitle'));
    }

    @IsTest
    static void testGetConfigByNameNotFound() {
        try {
            ChartBuddyConfigController.getConfigByName('Nonexistent');
            Assert.fail('Should have thrown');
        } catch (AuraHandledException e) {
            Assert.isTrue(e.getMessage().contains('not found'));
        }
    }

    @IsTest
    static void testSaveNewConfig() {
        Chart_Buddy_Config__c result = ChartBuddyConfigController.saveConfig(
            null,
            'New Config',
            'A new one',
            '{"containerTitle":"New","columns":[]}'
        );
        Assert.isNotNull(result.Id);
        Assert.areEqual('New Config', result.Name);
    }

    @IsTest
    static void testUpdateExistingConfig() {
        Chart_Buddy_Config__c existing = [SELECT Id FROM Chart_Buddy_Config__c WHERE Name = 'Test Dashboard' LIMIT 1];
        Chart_Buddy_Config__c result = ChartBuddyConfigController.saveConfig(
            existing.Id,
            'Updated Name',
            'Updated desc',
            '{"containerTitle":"Updated","columns":[]}'
        );
        Assert.areEqual(existing.Id, result.Id);
    }

    @IsTest
    static void testDeleteConfig() {
        Chart_Buddy_Config__c existing = [SELECT Id FROM Chart_Buddy_Config__c WHERE Name = 'Test Dashboard' LIMIT 1];
        ChartBuddyConfigController.deleteConfig(existing.Id);
        List<Chart_Buddy_Config__c> remaining = [SELECT Id FROM Chart_Buddy_Config__c WHERE Id = :existing.Id];
        Assert.isTrue(remaining.isEmpty(), 'Config should be deleted');
    }

    @IsTest
    static void testDeleteConfigBlankId() {
        try {
            ChartBuddyConfigController.deleteConfig('');
            Assert.fail('Should have thrown');
        } catch (AuraHandledException e) {
            Assert.isTrue(e.getMessage().contains('required'));
        }
    }

    @IsTest
    static void testPicklist() {
        ChartBuddyConfigPicklist picklist = new ChartBuddyConfigPicklist();
        VisualEditor.DataRow defaultRow = picklist.getDefaultValue();
        Assert.isNotNull(defaultRow);
        VisualEditor.DynamicPickListRows rows = picklist.getValues();
        Assert.isNotNull(rows);
    }
}
