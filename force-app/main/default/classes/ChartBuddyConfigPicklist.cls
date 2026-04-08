global class ChartBuddyConfigPicklist extends VisualEditor.DynamicPickList {
    global override VisualEditor.DataRow getDefaultValue() {
        return new VisualEditor.DataRow('-- Select Config --', '');
    }

    global override VisualEditor.DynamicPickListRows getValues() {
        VisualEditor.DynamicPickListRows rows = new VisualEditor.DynamicPickListRows();
        for (Chart_Buddy_Config__c config : [SELECT Name FROM Chart_Buddy_Config__c ORDER BY Name]) {
            rows.addRow(new VisualEditor.DataRow(config.Name, config.Name));
        }
        return rows;
    }
}
