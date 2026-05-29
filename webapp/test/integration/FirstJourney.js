sap.ui.define([
    "sap/ui/test/opaQunit",
    "./pages/JourneyRunner"
], function (opaTest, runner) {
    "use strict";

    function journey() {
        QUnit.module("First journey");

        opaTest("Start application", function (Given, When, Then) {
            Given.iStartMyApp();

            Then.onTheZQMM_C_Audit_HeaderList.iSeeThisPage();
            Then.onTheZQMM_C_Audit_HeaderList.onFilterBar().iCheckFilterField("Maint Plant");
            Then.onTheZQMM_C_Audit_HeaderList.onFilterBar().iCheckFilterField("Location");
            Then.onTheZQMM_C_Audit_HeaderList.onFilterBar().iCheckFilterField("Description");
            Then.onTheZQMM_C_Audit_HeaderList.onFilterBar().iCheckFilterField("Audit Status");
            Then.onTheZQMM_C_Audit_HeaderList.onFilterBar().iCheckFilterField("Created At");
            Then.onTheZQMM_C_Audit_HeaderList.onFilterBar().iCheckFilterField("Created By");
            Then.onTheZQMM_C_Audit_HeaderList.onTable().iCheckColumns(7, {"AuditDocId":{"header":"Audit #"},"MaintPlant":{"header":"Maint Plant"},"AssetLocation":{"header":"Location"},"AuditTitle":{"header":"Description"},"AuditStatus":{"header":"Audit Status"},"CreatedAt":{"header":"Created At"},"CreatedBy":{"header":"Created By"}});

        });


        opaTest("Navigate to ObjectPage", function (Given, When, Then) {
            // Note: this test will fail if the ListReport page doesn't show any data
            
            When.onTheZQMM_C_Audit_HeaderList.onFilterBar().iExecuteSearch();
            
            Then.onTheZQMM_C_Audit_HeaderList.onTable().iCheckRows();

            When.onTheZQMM_C_Audit_HeaderList.onTable().iPressRow(0);
            Then.onTheZQMM_C_Audit_HeaderObjectPage.iSeeThisPage();

        });

        opaTest("Teardown", function (Given, When, Then) { 
            // Cleanup
            Given.iTearDownMyApp();
        });
    }

    runner.run([journey]);
});