sap.ui.define(['sap/fe/test/ObjectPage'], function(ObjectPage) {
    'use strict';

    var CustomPageDefinitions = {
        actions: {},
        assertions: {}
    };

    return new ObjectPage(
        {
            appId: 'gc.agr.aafc.mm.eqauditmng',
            componentId: 'ZQMM_C_Audit_HeaderObjectPage',
            contextPath: '/ZQMM_C_Audit_Header'
        },
        CustomPageDefinitions
    );
});