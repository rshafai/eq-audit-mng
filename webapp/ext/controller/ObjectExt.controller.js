sap.ui.define([
    'sap/ui/core/mvc/ControllerExtension',
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/m/StandardListItem",
    "sap/ui/model/Sorter",
    "sap/ui/model/Filter",
	  "sap/ui/model/FilterOperator",
    "sap/ndc/BarcodeScanner",
    "sap/ui/core/Fragment",
    "sap/ui/model/json/JSONModel"
], function (ControllerExtension, MessageToast, MessageBox, StandardListItem, Sorter, Filter, FilterOperator, BarcodeScanner, Fragment, JSONModel) {
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
              // Set Supervisor/Auditor mode
              if (1 === 1){
                this._SuperMode = true;
              } else {
                this._SuperMode = false;
              }
              this.getView().setBusyIndicatorDelay(0);

            },
            routing: {
              onBeforeNavigation: function (oContext, oNavigationParameters) {
                // 1. Access row data
                var oRowData = oContext.getObject();
                
                // 2. Insert your custom logic here (e.g., validation, logging, conditional blocking)
                if (oRowData.Status === "Blocked") {
                    sap.m.MessageToast.show("Navigation blocked for this record.");
                    return false; // Prevents the standard object page navigation
                }

                // Return true or a Promise resolving to true to allow standard navigation to continue
                return true;
              }

            } // routing

        }, // override


//----------------------------------------------------------------------
// Edit Dialog
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
    this._openEditDialog(aContexts[0]);
},

_openEditDialog: function (oContext) {
  debugger;
    this.getView().setBusy(true);
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
            oldValueText: oEquipData[cfg.EquipFieldText],
            newValue: sPrefillValue,
            initialValue: sPrefillValue,  // to check changes later
            valueHelpEntity: cfg.VhEntity,
            valueHelpKeyField: cfg.VhKeyField,
            valueHelpDescField: cfg.VhDescField,
            approvalMode: this._SuperMode
          };
        });
  
        this._oDialogModel = new JSONModel({ fields: aRows });
        this._oItemContext = oContext;

        this._oDialogModel = new JSONModel({ fields: aRows });
        this._loadDialog().then(oDialog => {
          oDialog.setModel(oContext.getModel(), "itemCtx");
          oDialog.setBindingContext(oContext, "itemCtx");
          oDialog.setModel(this._oDialogModel, "dlg");
          oDialog.open();
        }).catch(oErr => {
          MessageBox.error("Could not load equipment data: " + oErr.message);
        }).finally(() => {
          this.getView().setBusy(false);
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
    const oSorter = [ new Sorter("Sequence", false) ];  // false = ascending
    const oModel = this.getView().getModel();
    return oModel.bindList("/AuditFieldConfig", null, oSorter).requestContexts(0, 100)
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
    return this.byId(sTableId);
  },

  onRevert: function(oEvent){
    const oInput = oEvent.getSource();
    const oRowContext = oInput.getBindingContext("dlg");
    const sNewValue = oRowContext.getObject()["oldValue"];
    const sPath = oRowContext.getPath() + "/newValue";

    let oModel = this._oDialog.getModel("dlg");
    oModel.setProperty(sPath, sNewValue);
  },
  
  formatColumns: function(sStatus) {
      return "Information"; //"Error"
  },

  
//---- SAVE ---------------------------

  onSaveAndApprove: function(oEvent){
    this._saveEquipChanges(true); // pass Approve = true through
  },
  
  onSaveEquipChanges: function () {
    this._saveEquipChanges(false);
  },

  _saveEquipChanges: function (bApproveFlag) {
    const aRows = this._oDialogModel.getProperty("/fields");
    const aChangedRows = aRows.filter(r => r.newValue !== r.initialValue);

    const oModel = this.getView().getModel();
    const oItemContext = this._oItemContext;
  
    // EquipmentCondition / Comments come from the itemCtx-bound fields, read directly
    const sCondition = oItemContext.getProperty("EqCondition");
    const sComments  = oItemContext.getProperty("Comments");
    const sEquipment  = oItemContext.getProperty("Equipment");
  
    const buildCall = (fieldName, oldValue, newValue, bApproveFlag) => {
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
      oBinding.setParameter("Approve", !!bApproveFlag);  // forces any value ("", undefined, "true", 0, etc.) into a genuine boolean 

      return oBinding.execute();
    };
  
    let aCalls;
    if (aChangedRows.length > 0) {
      aCalls = aChangedRows.map((r, i) =>
          buildCall(r.fieldName, r.oldValue, r.newValue, i === 0 ? bApproveFlag : false)
      );
    } else {
      // no field changes, but still need to push EquipmentCondition/Comments if touched
      aCalls = [ buildCall("", "", "", bApproveFlag) ];
    } 

    this._oDialog.setBusy(true);
    Promise.all(aCalls).then(() => {
      this._oDialog.setBusy(false);
      MessageToast.show("Changes saved.");
      this._oDialog.close();
      this._oItemContext.refresh();
      //this._oItemContext.requestSideEffects(["EqCondition", "Comments", "LastChangedAt", "_Change"]);
    }).catch(oErr => {
      this._oDialog.setBusy(false);
      MessageBox.error("Save failed: " + oErr.message);
    });
  },

  onCancelEquipDialog:function(oEvent){
    if (this._oDialog){
        this._oDialog.close();
    }
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

  
//-------------------------------------------------------------------
// Approve Item
//-------------------------------------------------------------------
  onApproveItems: function (oEvent, aContexts) {
    if (!aContexts) { return; }
    if (aContexts.length === 0) {
        MessageToast.show("Please select at least one item.");
        return null;
    }
    if (aContexts.length === 1) {
      this._openEditDialog(aContexts[0]);
    } else {
      this._confirmBulkApprove(aContexts);
    }
  },
  _confirmBulkApprove: function (aContexts) {
    MessageBox.confirm(
      `You are about to approve ${aContexts.length} audit items. Click OK to continue or Cancel to go back.`,
      {
        title: "Confirm Approval",
        onClose: (sAction) => {
          if (sAction === MessageBox.Action.OK) {
            this._executeBulkApprove(aContexts);
          }
        }
      }
    );
  },
  
  _executeBulkApprove: function (aContexts) {
    const oModel = this.getView().getModel();
  
    const aCalls = aContexts.map(oCtx => {
      const oBinding = oModel.bindContext(
        "com.sap.gateway.srvd.zqmm_ui_audit_header.v0001.approveItems(...)",
        oCtx
      );
      return oBinding.execute().then(() => oCtx.requestSideEffects(["AuditItemStatus"]));
    });
  
    Promise.all(aCalls).then(() => {
      MessageToast.show("Items approved.");
    }).catch(oErr => {
      MessageBox.error("Approval failed: " + oErr.message);
    });
  },

  
//-------------------------------------------------------------------
// Barcode Scan
//-------------------------------------------------------------------

  onBarcodeScan: function (oEvent) {
    debugger;
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

  },

  




  });
});
