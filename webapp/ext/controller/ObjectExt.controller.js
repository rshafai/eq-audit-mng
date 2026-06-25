sap.ui.define([
    'sap/ui/core/mvc/ControllerExtension',
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/m/StandardListItem",
    "sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
    "sap/ndc/BarcodeScanner",
    "sap/ui/core/Fragment",
    "sap/ui/model/json/JSONModel"
], function (ControllerExtension, MessageToast, MessageBox, StandardListItem, Filter, FilterOperator, BarcodeScanner, Fragment, JSONModel) {
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
// Dynamic Dialog
//----------------------------------------------------------------------
onEditEquipmentValues: function (oEvent, aContexts) {
    // Fiori Elements automatically passes the selected row context(s)
    if (!aContexts) {
        return;
    }
    if (aContexts.length === 0) {
        MessageToast.show("Please select an item first.");
        return null;
      }
      if (aContexts.length > 1) {
        MessageToast.show("Please select only one item.");
        return null;
      }
    this._oItemContext = aContexts[0];
    this.editEquipmentValues();
},

editEquipmentValues: function () {
  debugger;
    const oContext = this._oItemContext;
    const oEquipData = oContext.getObject();

    // Fetch existing change rows for this item via the _Change navigation
    const oChangeListBinding = oContext.getModel().bindList("_AuditChanges", oContext);

    oChangeListBinding.requestContexts(0, 100).then(aChangeContexts => {
          const aExistingChanges = aChangeContexts.map(c => c.getObject());

          this._getFieldConfig().then(aFieldConfig => {
            const aRows = aFieldConfig.map(cfg => {
              const oExisting = aExistingChanges.find(c => c.FieldName === cfg.FieldName);
              const sPrefillValue = oExisting ? oExisting.NewValue : oEquipData[cfg.EquipField];
  
              return {
                fieldName: cfg.FieldName,
                label: cfg.LabelEn,
                oldValue: oEquipData[cfg.EquipField],     // always master data
                newValue: sPrefillValue,
                initialValue: sPrefillValue,  // to check changes later
                valueHelpEntity: cfg.VhEntity,
                valueHelpKeyField: cfg.VhKeyField,
                valueHelpDescField: cfg.VhDescField
              };
            });
      
            this._oDialogModel = new JSONModel({ fields: aRows });
            this._loadDialog().then(oDialog => {
              oDialog.setModel(oContext.getModel(), "itemCtx");
              oDialog.setBindingContext(oContext, "itemCtx");
              oDialog.setModel(this._oDialogModel, "dlg");
              oDialog.open();
            });
          });
        });
  },

  _loadDialog: function () {
    if (!this._oDialog) {
      return Fragment.load({
        name: "gc.agr.aafc.mm.eqauditmng.ext.fragment.EditEquip",
        controller: this
      }).then(oDialog => {
        this._oDialog = oDialog;
        this.getView().addDependent(oDialog);
        return oDialog;
      });
    }
    return Promise.resolve(this._oDialog);
  },
  
  _getFieldConfig: function () {
    if (this._aFieldConfigCache) {
      return Promise.resolve(this._aFieldConfigCache);
    }
    const oModel = this.getView().getModel();
    return oModel.bindList("/AuditFieldConfig").requestContexts(0, 100)
      .then(aContexts => {
        this._aFieldConfigCache = aContexts.map(c => c.getObject());
        return this._aFieldConfigCache;
      });
  },

  _getSelectedItemContext: function () {
    const oTable = this._getItemsTable();
    if (!oTable) { return null; }
  
    const aSelectedContexts = oTable.getSelectedContexts();
  
    if (aSelectedContexts.length === 0) {
      MessageToast.show("Please select an item first.");
      return null;
    }
    if (aSelectedContexts.length > 1) {
      MessageToast.show("Please select only one item.");
      return null;
    }
    return aSelectedContexts[0];
  },
  
  _getItemsTable: function () {
    var sTableId = this.base.getView().getId() + "--fe::table::_AuditItems::LineItem";
    //gc.agr.aafc.mm.eqauditmng::ZQMM_C_Audit_HeaderObjectPage--fe::table::_AuditItems::LineItem
    //"gc.agr.aafc.mm.eqauditmng::ZQMM_C_Audit_HeaderObjectPage--fe::table::_Items::LineItem"
    return this.byId(sTableId);
  },
  
  //--- VH --------------

  onGenericVH: function (oEvent) {
    const oInput = oEvent.getSource();
    const oRowContext = oInput.getBindingContext("dlg");
    const sEntity = oRowContext.getProperty("valueHelpEntity");
    if (!sEntity) { return; }
  
    this._sActiveVHKeyField = oRowContext.getProperty("valueHelpKeyField");
    this._sActiveVHDescField = oRowContext.getProperty("valueHelpDescField");
    this._oActiveVHRowContext = oRowContext;
  
    this._loadGenericVHDialog().then(oDialog => {
      oDialog.unbindAggregation("items");
      oDialog.bindAggregation("items", {
        path: "/" + sEntity,
        template: new StandardListItem({
          title: "{" + this._sActiveVHKeyField + "}",
          description: "{" + this._sActiveVHDescField + "}"
        })
      });
      oDialog.setModel(this.getView().getModel());
      oDialog.open();
    });
  },
  
  _loadGenericVHDialog: function () {
    if (this._oGenericVHDialog) {
      return Promise.resolve(this._oGenericVHDialog);
    }
  
    return Fragment.load({
      id: this.getView().getId(),
      name: "gc.agr.aafc.mm.eqauditmng.ext.fragment.GenericSelectDialog",
      controller: this
    }).then(function (oDialog) {
      this._oGenericVHDialog = oDialog;
      this.getView().addDependent(oDialog);
      return oDialog;
    }.bind(this));
  },

  onGenericVHConfirm: function (oEvent) {
    const oSelectedItem = oEvent.getParameter("selectedItem");
    if (oSelectedItem) {
      const oSelectedData = oSelectedItem.getBindingContext().getObject();
      this._oActiveVHRowContext.getModel().setProperty(
        this._oActiveVHRowContext.getPath() + "/newValue",
        oSelectedData[this._sActiveVHKeyField]
      );
    }
  },
  onGenericVHSearch: function (oEvent) {
    const sValue = oEvent.getParameter("value");
    const oBinding = oEvent.getSource().getBinding("items");
    if (!oBinding) { return; }
  
    const sKeyField = this._sActiveVHKeyField;
    const sDescField = this._sActiveVHDescField;
  
    oBinding.filter(sValue ? new Filter({
      filters: [
        new Filter(sKeyField, FilterOperator.Contains, sValue),
        new Filter(sDescField, FilterOperator.Contains, sValue)
      ],
      and: false
    }) : []);
  },
  
  onGenericVHCancel: function (oEvent) {
    oEvent.getSource().getBinding("items").filter([]);
    this._sActiveVHKeyField = null;
    this._sActiveVHDescField = null;
    this._oActiveVHRowContext = null;
  },

//---- SAVE ---------------------------

onSaveEquipChanges: function () {
    const aRows = this._oDialogModel.getProperty("/fields");
    const aChangedRows = aRows.filter(r => r.newValue !== r.initialValue);

    const oModel = this.getView().getModel();
    const oItemContext = this._oItemContext;
  
    // EquipmentCondition / Comments come from the itemCtx-bound fields, read directly
    const sCondition = oItemContext.getProperty("EqCondition");
    const sComments  = oItemContext.getProperty("Comments");
    const sEquipment  = oItemContext.getProperty("Equipment");
  
    const buildCall = (fieldName, oldValue, newValue) => {
      const oBinding = oModel.bindContext(
        "com.sap.gateway.srvd.zqmm_ui_audit_header.v0001.saveEquipmentChanges(...)",
        oItemContext
      );
      oBinding.setParameter("FieldName", fieldName || "");
      oBinding.setParameter("OldValue", oldValue || "");
      oBinding.setParameter("NewValue", newValue || "");
      oBinding.setParameter("EqCondition", sCondition || "");
      oBinding.setParameter("Comments", sComments || "");
      oBinding.setParameter("Equipment", sEquipment || "");
      return oBinding.execute();
    };
  
    let aCalls;
    if (aChangedRows.length > 0) {
      aCalls = aChangedRows.map(r => buildCall(r.fieldName, r.oldValue, r.newValue));
    } else {
      // no field changes, but still need to push EquipmentCondition/Comments if touched
      aCalls = [ buildCall("", "", "") ];
    } 
  
    Promise.all(aCalls).then(() => {
      MessageToast.show("Changes saved.");
      this._oDialog.close();
      this._oItemContext.refresh();
      //this._oItemContext.requestSideEffects(["EqCondition", "Comments", "LastChangedAt", "_Change"]);
    }).catch(oErr => {
      MessageBox.error("Save failed: " + oErr.message);
    });
  },

  onCancelEquipDialog:function(oEvent){
    if (this._oDialog){
        this._oDialog.close();
    }
  }



//----------------------------------------------------------------------
    });
});
