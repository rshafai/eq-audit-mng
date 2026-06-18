sap.ui.define([
    'sap/ui/core/mvc/ControllerExtension',
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ndc/BarcodeScanner",
    "sap/ui/core/Fragment",
    "sap/ui/model/json/JSONModel"
], function (ControllerExtension, MessageToast, MessageBox, BarcodeScanner, Fragment, JSONModel) {
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

                // Initialize or clear the local edit model
                var oView = this.getView();
                var oJSONModel = new JSONModel({
                    MaintenancePlant : "",
                    AssetLocation : "",
                    AssetRoom : "",
                    FunctionalLocation : "",
                    CostCenter : "",
                    AssetManufacturerName : "",
                    ManufacturerCountry : "",
                    ManufacturerPartTypeName : "",
                    ManufacturerSerialNumber : "",
                    AcquisitionDate : "",
                    AcquisitionValue : "",
                    Currency : ""
                    });
                oView.setModel(oJSONModel, "editModel");
            },

        }, // override

        

        onManualEditSpecsPress: function (oEvent, aContexts) {
            // Fiori Elements automatically passes the selected row context(s)
            if (!aContexts || aContexts.length === 0) {
                return;
            }
            this.openEditSpecsDialog(aContexts[0]);
        },

        openEditSpecsDialog: function (oItemContext) {
            this._oCurrentItemContext = oItemContext;
            var oView = this.getView();
            
            if (!this._oDialog) {
                Fragment.load({
                    id: oView.getId(),
                    name: "gc.agr.aafc.mm.eqauditmng.ext.fragment.EditSpecsPopup",					
                    controller: this
                }).then(function (oDialog) {
                    this._oDialog = oDialog;
                    oView.addDependent(this._oDialog);
                    this._fetchAndShowDefaultValues();
                }.bind(this));
            } else {
                this._fetchAndShowDefaultValues();
            }
        },

        _fetchAndShowDefaultValues: function () {
debugger;                
            var oView = this.getView();
            this._oDialog.setBusy(true);
            this._oDialog.open();

            // Create a data context path to the equipment master node
            var sMasterPath = this._oCurrentItemContext.getPath() + "/_Equipment"; 
            var oModel = oView.getModel();
            var oContextBinding = oModel.bindContext(sMasterPath);

            // 2. Request individual properties to bypass "type raw" formatting issues
            var aProperties = ["MaintenancePlant", "AssetLocation", "AssetRoom","FunctionalLocation",
                                "CostCenter", "AssetManufacturerName","ManufacturerCountry","ManufacturerPartTypeName", "ManufacturerSerialNumber",
                                "AcquisitionDate", "AcquisitionValue","Currency"];
            
            Promise.all(aProperties.map(function(sProp) {
                return oContextBinding.getBoundContext().requestProperty(sProp);
            })).then(function (aValues) {
                this._oDialog.setBusy(false);
                // Populate json model with the defaults
                var oEditModel = oView.getModel("editModel");
                oEditModel.setProperty("/MaintenancePlant",         aValues[0] || "");
                oEditModel.setProperty("/AssetLocation",            aValues[1] || "");
                oEditModel.setProperty("/AssetRoom",                aValues[2] || "");
                oEditModel.setProperty("/FunctionalLocation",       aValues[3] || "");
                oEditModel.setProperty("/CostCenter",               aValues[4] || "");
                oEditModel.setProperty("/AssetManufacturerName",    aValues[5] || "");
                oEditModel.setProperty("/ManufacturerCountry",      aValues[6] || "");
                oEditModel.setProperty("/ManufacturerPartTypeName", aValues[7] || "");
                oEditModel.setProperty("/ManufacturerSerialNumber", aValues[8] || "");
                oEditModel.setProperty("/AcquisitionDate",          aValues[9] || "");
                oEditModel.setProperty("/AcquisitionValue",         aValues[10] || "");
                oEditModel.setProperty("/Currency",                 aValues[11] || "");

            }.bind(this)).catch(function (oError) {
                this._oDialog.setBusy(false);
                MessageBox.error("Could not fetch baseline values from master data.");
            }.bind(this));
        },

        onSubmitSpecs: function () {
debugger;
var oView = this.getView();
this._oDialog.setBusy(true);

var oEditData = oView.getModel("editModel").getData();
var oModel = oView.getModel();

var sActionName = "SAP__self.logEquipmentChanges(...)";
var sFullyQualifiedAction  = "com.sap.gateway.srvd.zqmm_ui_audit_header.v0001.logEquipmentChanges";

var oActionParameters = [
    { name: 'AssetManufacturerName', value: oEditData.AssetManufacturerName },
    { name: 'ManufacturerCountry', value: oEditData.ManufacturerCountry }
];
var oExtensionAPI = this.base.getExtensionAPI(); 
    
    oExtensionAPI.editFlow.invokeAction(sFullyQualifiedAction, {
        contexts: [this._oCurrentItemContext], // Passes your active row context array cleanly
        parameterValues: oActionParameters,
        skipParameterDialog: true
    }).then(function () {
        this._oDialog.setBusy(false);
        this._oDialog.close();
        sap.m.MessageBox.success("Equipment modifications successfully logged for approval.");
        
        // Refresh the row context to reflect changes instantly on the UI
        this._oCurrentItemContext.getBinding().refresh();
    }.bind(this)).catch(function (oError) {
        this._oDialog.setBusy(false);
        // This will now catch and display actual backend or validation errors
        console.error("Action Call Error Details: ", oError);
        sap.m.MessageBox.error("Failed to log modifications. Check console for details.");
    }.bind(this));
},

        onCancelSpecs: function () {
            this._oDialog.close();
        },

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

                            // Select/highlight the row, you must access the inner control
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
