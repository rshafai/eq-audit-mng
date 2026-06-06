sap.ui.define(['sap/ui/core/mvc/ControllerExtension'], function (ControllerExtension) {
	'use strict';

	return ControllerExtension.extend('gc.agr.aafc.mm.eqauditmng.ext.controller.ObjectExt', {
		// this section allows to extend lifecycle hooks or hooks provided by Fiori elements
		override: {
			/**
             * Called when a controller is instantiated and its View controls (if available) are already created.
             * Can be used to modify the View before it is displayed, to bind event handlers and do other one-time initialization.
             * @memberOf gc.agr.aafc.mm.eqauditmng.ext.controller.ObjectExt
             */
			onInit: function () {
				// you can access the Fiori elements extensionAPI via this.base.getExtensionAPI
				//var oModel = this.base.getExtensionAPI().getModel();
			},

		}, // override

		
		onBarcodeScan: function(oEvent){
debugger;			
							// 1. Get the context of the Fiori Elements application
                var oExtensionAPI = this.base.getExtensionAPI();
                
                // 2. Retrieve selected rows from the item table
                var aSelectedContexts = oExtensionAPI.getSelectedContexts(oEvent.getSource());
                
                if (aSelectedContexts.length === 0) {
                    MessageToast.show("Please select at least one item row.");
                    return;
                }

                // 3. Loop through your child records and extract backend data
                aSelectedContexts.forEach(function (oContext) {
                    var oRowData = oContext.getObject();
                    console.log("Selected Item ID: " + oRowData.ItemID);
                });

                // 4. Execute your custom front-end logic (e.g., call a standard dialog, validate fields, etc.)
                MessageToast.show("Invoked custom UI function successfully!");

		}



	});
});
