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
            }

//             editFlow: {
//                 onAfterBinding: function (oBindingContext) {
//                     // This callback function is automatically executed by Fiori Elements
//                     // the exact millisecond any automatic ba
// debugger
//                 },
//             }
        }, // override

        
        //onManualEditSpecsPress: function (oEvent) {
        showEditPopup: function(oItemContext) {
debugger;
            this._oCurrentItemContext = oItemContext;
            var oView = this.getView();
            var oAuditItem = oItemContext.getObject();
            var sEquipmentId = oAuditItem.Equipment;

            // Pad the Equipment ID with 0s
            var sInternalEquipmentId = sEquipmentId;
            if (/^\d+$/.test(sEquipmentId)) {
                sInternalEquipmentId = sEquipmentId.padStart(18, '0');
            }
            
            // Save these variables globally/locally on the controller for your later SAVE payload
            this._sCurrentAuditDocId = oAuditItem.AuditDocId;
            this._sCurrentItemNumber = oAuditItem.ItemNumber;
        
            if (!this._oDialog) {
                this._oDialog = this.base.getExtensionAPI().loadFragment({
                    id: oView.getId(),
                    name: "gc.agr.aafc.mm.eqauditmng.ext.fragment.EditSpecsPopup",
                    controller: this,
                    initialBindingContext: oItemContext
                }).then(function (oDialog) { 
                    this._oDialog = oDialog;
                    oView.addDependent(oDialog);
                    return oDialog;
                }.bind(this));
                this._oDialog.then(function (oDialog) {
                    oDialog.setBindingContext(oItemContext);  //bindContext("/AuditHeader/_AuditItems(...)")
                    this._getMasterData(oDialog);
                    oDialog.attachModelContextChange(function(oMasterData) {
                        debugger;
                    }.bind(this))
                }.bind(this));
            } else {
                this._getMasterData(this._oDialog);
            }

            
        },
        _getMasterData: function(oDialog){
            var aContent = oDialog.getContent ? oDialog.getContent() : [];
            var oModel = this.getView().getModel(); 
            var oForm = aContent.find(function(oControl) {
                return oControl.getMetadata().getName().includes("Form") || oControl.getId().includes("idFormChange");
            });

            if (!oModel || !oForm) {return;}

            if (!this._fnDataReceivedCallback) {
                this._fnDataReceivedCallback = function(oEvent) {
                    var oParameters = oEvent.getParameters();
                    
                    // Guard check: Exit if the $batch failed on the backend
                    if (oParameters && oParameters.error) { 
                        console.error("Backend request failed: ", oParameters.error);
                        return; 
                    }
        
                    // Read the context directly from the Form control now that the batch returned
                    if (oForm) {
                        var oFormContext = oForm.getBindingContext();
                        if (oFormContext) {
                            var oServerResponseData = oFormContext.getObject();
                            if (oServerResponseData && oServerResponseData.MaintenancePlant !== undefined) {
                                debugger; // 🎯 TRAPPED! Hits every single time the fresh batch response arrives.
                                console.log("Extracted OData V4 Response Data:", oServerResponseData);
        
                                // Deep copy the server fields into your secondary local JSON model
                                var oLocalCopy = JSON.parse(JSON.stringify(oServerResponseData));
                                var oJsonModel = new sap.ui.model.json.JSONModel(oLocalCopy);
                                oDialog.setModel(oJsonModel, "localBufferModel");
                                
                                // Clean up: Detach this precise listener immediately
                                oModel.detachDataReceived(this._fnDataReceivedCallback);
                            }
                        }
                    }
                }.bind(this); // Ensure 'this' points to your controller instance inside the callback
            }

            if (oModel) {
                oModel.attachDataReceived(this._fnDataReceivedCallback); 
            }
            if (oForm) {
                var oBindingContext = oForm.getBindingContext();
                if (oBindingContext) {
                    var oBinding = oBindingContext.getBinding();
                    
                    if (oBinding && oBinding.changeParameters) {
                        oBinding.changeParameters({
                            "cacheBuster": "ts_" + Date.now() 
                        });
                    }
                }
            }
            oDialog.open();
        

            //     this._fnDataReceivedCallback = function (oEvent) {
            //         var oParameters = oEvent.getParameters();
                    
            //         // Guard check: Exit if the $batch actually failed on the backend
            //         if (oParameters && oParameters.error) { 
            //             console.error("Backend request failed: ", oParameters.error);
            //             return; 
            //         }
            //         // Because the batch has returned, the form's binding context is now fully hydrated.
            //         var oFormContext = oForm.getBindingContext();
                    
            //         if (oFormContext) {
            //             var oServerResponseData = oFormContext.getObject();
            //             if (oServerResponseData && oServerResponseData.MaintenancePlant !== undefined) {
            //                 console.log("Extracted OData V4 Response Data:", oServerResponseData);

            //                 // 7. Deep copy the server fields into your secondary local JSON model
            //                 let oLocalCopy = JSON.parse(JSON.stringify(oServerResponseData));
            //                 let oJsonModel = new sap.ui.model.json.JSONModel(oLocalCopy);
            //                 oDialog.setModel(oJsonModel, "localBufferModel");
                            
            //                 // 9. Clean up: Detach the listener immediately so it doesn't execute during other actions
            //                 oModel.detachDataReceived(this._fnDataReceivedCallback);
            //             }
            //         }
            //     };
            //     oModel.attachDataReceived(this._fnDataReceivedCallback);
            //     oDialog.open();                
            // }

        },
        onValueHelp: function(oEvent){
            debugger;
        },
        
        _bindAndOpenDialog: function(sEquipmentId) {
            //NOT USED ----
            var oView = this.getView();
            
            // 1. Manually construct the OData V4 entity path
            // For single-key string parameters, wrap the ID in single quotes
            var sPath = "/ZQMM_R_Equip_BarcodeTR('" + sEquipmentId + "')";
            //-- Relative paths generate errors in XML binding - it always binds to header
            //-- var sPath = this._oCurrentItemContext.getPath(); // + "/_Equipment"; 

            // this._oDialog.unbindElement();
            // this._oDialog.setBindingContext(null);

            // 2. Bind the Dialog directly using OData V4 parameters
            this._oDialog.bindElement({
                path: sPath,
                parameters: {
                    // Optional: specify group ID to prevent auto-submitting layout updates to the backend
                    $$updateGroupId: 'equipmentUpdateGroup' 
                },
                events: {
                    dataReceived: function(oEvent) {
                        var oHandler = oEvent.getParameter("error");
                        if (oHandler) {
                            sap.m.MessageBox.error("Could not load equipment master data.");
                            return;
                        }
                        
                        // Fetch data from the newly bound context to populate your custom status header
                        var oBindingContext = this._oDialog.getBindingContext();
                        if (oBindingContext) {
                            // var sStatus = oBindingContext.getProperty("EquipmentStatusText"); // Adjust property name if different in R_EquipmentTR
                            // this.byId("txtStatus").setText(sStatus || "ACTIVE");
                        }
                    }.bind(this)
                }
            });
        
            this._oDialog.open();
        },

        onSaveEquipmentChanges: function () {
            var oDataModel = this.getView().getModel();
            var oBindingContext = this._oDialog.getBindingContext();
            
            if (!oBindingContext) {
                return;
            }
        
            // 1. Set the dialog to busy to prevent multiple clicks
            this._oDialog.setBusy(true);
        
            // 2. Extract the live values from the OData V4 context binding
            var oPayload = {
                AuditDocId: this._sCurrentAuditDocId, // Captured when opening the dialog
                ItemNumber: this._sCurrentItemNumber, // Captured when opening the dialog
                MaintenancePlant: oBindingContext.getProperty("MaintenancePlant") || "",
                ManufacturerName: oBindingContext.getProperty("AssetManufacturerName") || "",
                ManufacturerSerialNumber: oBindingContext.getProperty("ManufacturerSerialNumber") || ""
            };
        
            // 3. Bind the execution context to your RAP Bound/Unbound Action 
            // Adjust the path to match your exact action registration name
            var sNamespacePath  = "com.sap.gateway.srvd.zqmm_ui_audit_header.v0001.logEquipmentChanges";
            var sActionPath = "/ZQMM_C_Audit_Header('" + this._sCurrentAuditDocId + "')/" + sNamespacePath;
            var oExtensionAPI = this.base.getExtensionAPI(); 

            var oActionParameters = [
                { name: 'MaintenancePlant', value: oBindingContext.getProperty("MaintenancePlant") },
                { name: 'AssetManufacturerName', value: oBindingContext.getProperty("AssetManufacturerName") },
                { name: 'ManufacturerSerialNumber', value: oBindingContext.getProperty("ManufacturerSerialNumber") }
            ];
    oExtensionAPI.editFlow.invokeAction(sNamespacePath, {
        contexts: [this._oCurrentItemContext], // Passes your active row context array cleanly
        parameterValues: oActionParameters,
        skipParameterDialog: true
    }).then(function (aResult) {
                this._oDialog.setBusy(false);
                this._oDialog.close();
                let oResult = aResult[0];
                if (oResult.status === "rejected"){
                    console.log("Error returned from backend: " + oResult.reason);
                } else{
                    MessageToast.show("Equipment changes logged successfully.");
                    oDataModel.resetChanges('equipmentUpdateGroup'); 
                    oDataModel.refresh(); 
                }
            }.bind(this)).catch(function (oError) {
                this._oDialog.setBusy(false);
                MessageBox.error("Save failed: " + oError.getMessage());
            }.bind(this));
        },
        
        onCloseEquipmentDialog: function () {
            if (this._oDialog) {
                this._oDialog.close();
            }
        },
        
        onAfterClose: function(oEvent){
            if (this._oDialog) {
                //this._oDialog.close();
                this.getView().getModel().resetChanges('equipmentUpdateGroup');

                var oLocalModel = this._oDialog.getModel("localBufferModel");
                if (oLocalModel) {
                    oLocalModel.setData({}); 
                }

                var aContent = this._oDialog.getContent ? this._oDialog.getContent() : [];
                var oForm = aContent.find(function(oControl) {
                    return oControl.getMetadata().getName().includes("Form") || oControl.getId().includes("idFormChange");
                });

                // 4. THE FIX: Forcefully unbind the OData V4 contexts so the engine treats it as brand new next time
                if (oForm) {
                    oForm.setBindingContext(null); // Strips the current row instance pointers
                }
                this._oDialog.setBindingContext(null);

                // 5. Alternative/Fail-safe: If your Fiori elements layout binds via a dedicated path, 
                // unbind the element explicitly to destroy the runtime binding tree.
                // if (oForm && oForm.unbindElement) {
                //      oForm.unbindElement(); 
                // }
            }
        },
        onDialogAfterOpen: function() {
        },
        onDialogBeforeOpen: function(oEvent){
debugger;
var aContent = this._oDialog.getContent ? this._oDialog.getContent() : [];
            var oModel = this.getView().getModel(); 
            var oForm = aContent.find(function(oControl) {
                return oControl.getMetadata().getName().includes("Form") || oControl.getId().includes("idFormChange");
            });
//oForm.getBindingContext().refresh();
var oModel = this.getView().getModel();
            if (oModel) {
                // Use the exact tracking callback function we built in the previous step
                oModel.attachDataReceived(this._fnDataReceivedCallback); 
            }

        },



//----------------------------------------------------------------------
// Using json model - NOT USED
//----------------------------------------------------------------------
        onManualEditSpecsPress: function (oEvent, aContexts) {
            // Fiori Elements automatically passes the selected row context(s)
            if (!aContexts || aContexts.length === 0) {
                return;
            }
            //this.openEditSpecsDialog(aContexts[0]);
            this.showEditPopup(aContexts[0]);
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
