sap.ui.define(['sap/fe/test/ListReport'], function(ListReport) {
    'use strict';

    var CustomPageDefinitions = {
        actions: {},
        assertions: {}
    };

    return new ListReport(
        {
            appId: 'gc.agr.aafc.mm.eqauditmng',
            componentId: 'ZQMM_C_Audit_HeaderList',
            contextPath: '/ZQMM_C_Audit_Header'
        },
        CustomPageDefinitions
    );
});