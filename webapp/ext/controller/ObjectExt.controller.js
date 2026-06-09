sap.ui.define([
    'sap/ui/core/mvc/ControllerExtension',
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ndc/BarcodeScanner",
    "sap/ui/model/json/JSONModel"
], function (ControllerExtension, MessageBox, MessageToast, BarcodeScanner, JSONModel) {
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


        onBarcodeScan: function (oEvent) {
            debugger;
            //MessageToast.show("Barcode scanned successfully");

            BarcodeScanner.scan(
                function (mResult) {
                    console.log("We got a barcode\n" + "Result: " + mResult.text + "\n" + "Format: " + mResult.format + "\n" + "Cancelled: " + mResult.cancelled);
                    this._onScanSuccess(mResult);
                }.bind(this),
                function (Error) {
                    MessageBox.error("Scanning failed: " + Error);
                },
                function (mParams) {
                    //console.log("Value entered: " + mParams.newValue);
                },
                "Scan a barcode or type-in an equipment number to searh for",  //title
                true,                       //preferFrontCamera
                30,                         //frameRate
                1,                          //zoom
                false,                      //keepCameraScan
                false                       //disableBarcodeInputDialog
            );


        },
        _onScanSuccess: function (mResult) {
            if (mResult.cancelled) {
                MessageToast.show("Scan cancelled", { duration: 1000 });
            } else {
                var sBarCode = mResult.text;
                var oExtensionAPI = this.base.getExtensionAPI();
                
                var sViewId = this.base.getView().getId();
                var sTableId = sViewId + "--fe::table::_Items::LineItem";
                
                var oTable = sap.ui.getCore().byId(sTableId);
                if (oTable) {
                    var oBinding = oTable.getRowBinding();
                    if (oBinding) {
                        var aContexts = oBinding.getCurrentContexts();
                        var oMatchedContext = aContexts.find(function (oContext) {
                            return oContext && oContext.getProperty("Equipment") === sBarCode;
                        });

                        if (oMatchedContext) {
                            // Success: Located the row in the table
                            var oData = oMatchedContext.getObject();
                            sap.m.MessageToast.show("Found Equipment: " + oData.Equipment);

                            // Optional: To select/highlight the row, you must access the inner control
                            var oInnerTable = sap.ui.getCore().byId(sTableId + "-innerTable");
                            if (oInnerTable && typeof oInnerTable.getItems === "function") {
                                var aItems = oInnerTable.getItems();
                                var oRowToSelect = aItems.find(function(oItem) {
                                    return typeof oItem.getBindingContext === "function" && oItem.getBindingContext() === oMatchedContext;
                                });
                                if (oRowToSelect) {
                                    // Highlight the left border green
                                    if (typeof oRowToSelect.setHighlight === "function") {
                                        oRowToSelect.setHighlight(sap.ui.core.MessageType.Success); 
                                    }
                                    // Select the checkbox if applicable
                                    if (typeof oInnerTable.setSelectedItem === "function") {
                                        oInnerTable.setSelectedItem(oRowToSelect, true);
                                    }
                                    // Scroll viewport focus to the row
                                    oRowToSelect.focus();
                                }
                            }

                        } else {
                            sap.m.MessageToast.show("Equipment not loaded or not found in this table.");
                        }
                    }
                } else {
                    console.error("Could not find table with ID: " + sTableId);
                }
            }



            //var oTable = this.byId("gc.agr.aafc.mm.eqauditmng::ZQMM_C_Audit_HeaderObjectPage--fe::table::_Items::LineItem");

            // var oFilterBar = this.byId("ca.gc.agr.equipbcodelr::sap.suite.ui.generic.template.ListReport.view.ListReport::ZQMM_C_EQ_Barcode--listReportFilter"); //this.byId("worklistFilterBar");
            // var oFilterData = oFilterBar.getFilterData();
            // oFilterData.EquipmentTrim = {
            //     items: [],
            //     ranges: [],
            //     value: sBarCode
            // };
            // oFilterBar.setFilterData(oFilterData);
            // oFilterBar.search();

        },



    });
});
