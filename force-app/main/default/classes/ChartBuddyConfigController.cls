public with sharing class ChartBuddyConfigController {
    @AuraEnabled(cacheable=true)
    public static List<Chart_Buddy_Config__c> getConfigs() {
        return [
            SELECT Id, Name, Description__c, Config_JSON__c
            FROM Chart_Buddy_Config__c
            ORDER BY Name
        ];
    }

    @AuraEnabled(cacheable=true)
    public static Chart_Buddy_Config__c getConfigByName(String configName) {
        List<Chart_Buddy_Config__c> configs = [
            SELECT Id, Name, Description__c, Config_JSON__c
            FROM Chart_Buddy_Config__c
            WHERE Name = :configName
            LIMIT 1
        ];
        if (configs.isEmpty()) {
            throw new AuraHandledException('Config not found: ' + configName);
        }
        return configs[0];
    }

    @AuraEnabled
    public static Chart_Buddy_Config__c saveConfig(
        String configId,
        String name,
        String description,
        String configJson
    ) {
        Chart_Buddy_Config__c config;
        if (String.isNotBlank(configId)) {
            config = [SELECT Id FROM Chart_Buddy_Config__c WHERE Id = :configId LIMIT 1];
            config.Name = name;
        } else {
            config = new Chart_Buddy_Config__c(Name = name);
        }
        config.Description__c = description;
        config.Config_JSON__c = configJson;
        upsert config;
        return config;
    }

    @AuraEnabled
    public static void deleteConfig(String configId) {
        if (String.isBlank(configId)) {
            throw new AuraHandledException('Config ID is required');
        }
        delete [SELECT Id FROM Chart_Buddy_Config__c WHERE Id = :configId LIMIT 1];
    }
}
