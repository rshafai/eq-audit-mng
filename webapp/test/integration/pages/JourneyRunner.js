sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"gc/agr/aafc/mm/eqauditmng/test/integration/pages/ZQMM_C_Audit_HeaderList",
	"gc/agr/aafc/mm/eqauditmng/test/integration/pages/ZQMM_C_Audit_HeaderObjectPage"
], function (JourneyRunner, ZQMM_C_Audit_HeaderList, ZQMM_C_Audit_HeaderObjectPage) {
    'use strict';

    var runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('gc/agr/aafc/mm/eqauditmng') + '/test/flp.html#app-preview',
        pages: {
			onTheZQMM_C_Audit_HeaderList: ZQMM_C_Audit_HeaderList,
			onTheZQMM_C_Audit_HeaderObjectPage: ZQMM_C_Audit_HeaderObjectPage
        },
        async: true
    });

    return runner;
});

