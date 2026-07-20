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

      _fragmentPrefix : "gc.agr.aafc.mm.eqauditmng.ext.fragment.",

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
                var oRowData = oContext.getObject();
                if (oRowData.Status === "Blocked") {
                    sap.m.MessageToast.show("Navigation blocked for this record.");
                    return false; // Prevents the standard object page navigation
                }
                return true;
              },
              onAfterBinding: function () {
                const oExtensionAPI = this.base.getExtensionAPI();
                this._sTableId = this.base.getView().getId() + "--fe::table::_AuditItems::LineItem"; //gc.agr.aafc.mm.eqauditmng::ZQMM_C_Audit_HeaderObjectPage--fe::table::_AuditItems::LineItem
                this._oItemTable = this.base.byId(this._sTableId);
                
                if (this._oItemTable) {
                  this._oItemTable.attachSelectionChange(this.onTableSelectionChange, this);
                }
                this._oItemTable.removeSelections(true);
                this._oItemTable.fireSelectionChange();
            }


            } // routing

        }, // override


  onTableSelectionChange: function (oEvent) {
      const aSelectedContexts = this.base.getExtensionAPI().getSelectedContexts(oEvent.getParameter("id"));
      const oUiModel = this.getView().getModel("ui");

      let showEdit = false;
      let showApprove = false;

      if (aSelectedContexts.length === 1) {
          const oSelectedData = aSelectedContexts[0].getObject(); 
          const sStatus = oSelectedData.AuditItemStatus;
          showEdit = true; //(sStatus !== "030");  //Audited
      } else {
        showApprove = true;
      }
      oUiModel.setProperty("/showEdit", showEdit);
      oUiModel.setProperty("/showApprove", showApprove);
  },

  //────────────────────────────────────────
  // Edit Dialog
  //────────────────────────────────────────
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
    this.getView().setBusy(true);
    const oEquipData = oContext.getObject();
    const oChangeListBinding = oContext.getModel().bindList("_AuditChanges", oContext);

    oChangeListBinding.requestContexts(0, 100).then(aChangeContexts => {
      const aExistingChanges = aChangeContexts.map(c => c.getObject());

      this._getFieldConfig().then(aFieldConfig => {

        const aRows = aFieldConfig.map(cfg => {
          const oExisting = aExistingChanges.find(c => c.FieldName === cfg.FieldName);
          const sPrefillValue = oExisting ? oExisting.NewValue : oEquipData[cfg.EquipField];
          return {
            fieldName:          cfg.FieldName,
            label:              cfg.LabelEn,
            oldValue:           oEquipData[cfg.EquipField],     // always master data
            oldValueText:       oEquipData[cfg.EquipFieldText],
            newValue:           sPrefillValue,
            initialValue:       sPrefillValue,  // to check changes later
            valueHelpEntity:    cfg.VhEntity,
            valueHelpKeyField:  cfg.VhKeyField,
            valueHelpDescField: cfg.VhDescField,
            //approvalMode:       this._SuperMode
          };
        });

        this._oDialogModel = new JSONModel({
          fields:       aRows,
          approvalMode: !!this._SuperMode,
          Comments:     oEquipData.Comments     || "",
          EqCondition:  oEquipData.EqCondition  || "",
          Equipment:    oEquipData.Equipment    || "",
        });

        this._oItemContext = oContext;

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
        name: this._fragmentPrefix + "EditEquip",
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
  //────────────────────────────────────────

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
    const sCondition = this._oDialogModel.getProperty("/EqCondition");   //oItemContext.getProperty("EqCondition");
    const sComments  = this._oDialogModel.getProperty("/Comments");
    const sEquipment  = this._oDialogModel.getProperty("/Equipment");     //oItemContext.getProperty("Equipment");
    const sActionName = "com.sap.gateway.srvd.zqmm_ui_audit_header.v0001.saveEquipmentChanges";
  
    const buildSingleCall = (fieldName, oldValue, newValue, equipField, bApproveFlag) => {
      return this.base.editFlow.securedExecution(
        () => {
          const oBinding = oModel.bindContext( sActionName + "(...)", oItemContext );
          oBinding.setParameter("FieldName",   fieldName   || "");
          oBinding.setParameter("OldValue",    oldValue    || "");
          oBinding.setParameter("NewValue",    newValue    || "");
          oBinding.setParameter("EquipField",  equipField  || "");
          oBinding.setParameter("EqCondition", sCondition  || "");
          oBinding.setParameter("Comments",    sComments   || "");
          oBinding.setParameter("Equipment",   sEquipment  || "");
          oBinding.setParameter("Approve",     !!bApproveFlag);
          return oBinding.execute();
        },
        {
          updatableObject: oItemContext, busyControl: this.getView()
        }
      );
    };
  
    let aCalls;
    if (aChangedRows.length > 0) {
      aCalls = aChangedRows.map((row, i) =>
        buildSingleCall(
          row.fieldName, row.oldValue, row.newValue, row.equipmentField, i === 0 ? bApproveFlag : false
        )
      );
    } else {
      aCalls = [ buildSingleCall("", "", "", "", bApproveFlag) ];
    }


    this._oDialog.setBusy(true);  // the framework sets the main page busy, but not the dialog
    Promise.all(aCalls).then(() => {
      this._oDialog.setBusy(false);
      MessageToast.show(bApproveFlag ? "Item approved." : "Changes saved.");
      this._oDialog.close();
      this._oItemContext.refresh();
      this._oItemContext.requestSideEffects([  //"EqCondition", "Comments",
        "AuditItemStatus", "AuditItemStatusText", "AuditItemStatusCriticality", "LastChangedAt", "_Change"
      ]);
    }).catch(oErr => {
      this._oDialog.setBusy(false);
      MessageBox.error((bApproveFlag ? "Approval" : "Save") + " failed: " + oErr.message);
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
      name: this._fragmentPrefix + "GenericSelectDialog",
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
// Approve Items
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

  
//────────────────────────────────────────
// Barcode Scan
//────────────────────────────────────────

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

        if (this._oItemTable) {
          var oBinding = this._oItemTable.getRowBinding();
          if (oBinding) {
            var aContexts = oBinding.getCurrentContexts();
            var oMatchedContext = aContexts.find(function (oContext) {
                return oContext && oContext.getProperty("Equipment") === sBarCode;
            });
            _highlightItemRow(oMatchedContext);
          }
        } else {
          console.error("Could not find table with ID: " + sTableId);
        }
    }
  },


  _highlightItemRow(oContext){
    if (oContext) {
      var oData = oContext.getObject();
      MessageToast.show("Found Equipment: " + oData.Equipment);

      var oInnerTable = sap.ui.getCore().byId(this._sTableId + "-innerTable");
      if (oInnerTable && typeof oInnerTable.getItems === "function") {
        var aItems = oInnerTable.getItems();
        var oRowToSelect = aItems.find(function(oItem) {
            return typeof oItem.getBindingContext === "function" && oItem.getBindingContext() === oContext;
        });
        if (oRowToSelect) {
          // Scroll viewport focus to the row
          oRowToSelect.focus();
          // Highlight the left border green
          if (typeof oRowToSelect.setHighlight === "function") {
            //reset previously highlighted rows
            $.each(aItems, function(index, row){
              row.setHighlight(sap.ui.core.MessageType.None);
            });
            oRowToSelect.setHighlight(sap.ui.core.MessageType.Success); 
          }
          // Select the checkbox and open edit/details dialog
          if (typeof oInnerTable.setSelectedItem === "function") {
            oInnerTable.removeSelections(true);
            oInnerTable.setSelectedItem(oRowToSelect, true);
            oInnerTable.fireSelectionChange();
            //Open edit dialog
            this._openEditDialog(oContext);
          }
        }
      }
    } else {
        MessageToast.show("Equipment not loaded or not found in this table.");
    }
  },

  _highlightItemRow2: function (oContext) {
    const oTable = this._getItemsTable();
  
    // scroll to and select the row
    const aItems = oTable.getItems();
    const oMatchItem = aItems.find(oItem =>
      oItem.getBindingContext() === oContext ||
      oItem.getBindingContext().getPath() === oContext.getPath()
    );
  
    if (!oMatchItem) { return; }
  
    // scroll into view
    oTable.scrollToIndex(aItems.indexOf(oMatchItem));
  
    // select the row
    oTable.setSelectedItem(oMatchItem, true);
  
    // highlight briefly with ValueState if supported, or just rely on selection
    oMatchItem.addStyleClass("sapUiDemoHighlight");
    setTimeout(() => oMatchItem.removeStyleClass("sapUiDemoHighlight"), 2000);
  },


//────────────────────────────────────────
// Manual Search
//────────────────────────────────────────
onManualSearchButtonPress: function (oContext, aSelectedContexts) {
  this._loadManualSearchPopover().then(oPopover => {
    const sButtonId = this.base.getView().getId() + "--fe::table::_AuditItems::LineItem::CustomAction::ManualSearch";
    const oButton = sap.ui.getCore().byId(sButtonId);

    if (oButton) {
      oPopover.openBy(oButton);
    } else {
      oPopover.openBy(this.base.getView());
    }
  });
},

_loadManualSearchPopover: function () {
  if (this._oManualSearchPopover) {
    return Promise.resolve(this._oManualSearchPopover);
  }
  return Fragment.load({
    id: this.getView().getId(),
    name: this._fragmentPrefix + "ManualSearchPopover",
    controller: this
  }).then(oPopover => {
    this._oManualSearchPopover = oPopover;
    this.getView().addDependent(oPopover);
    return oPopover;
  });
},

onManualSearchEquipment: function (oEvent) {
  const sQuery = oEvent.getParameter("query").trim();
  if (!sQuery) { return; }

  const oTable = this._oItemTable;
  const aContexts = oTable.getRowBinding().getCurrentContexts(); //oTable.getBinding("items").getCurrentContexts();

  // normalize - pad to 18 chars to handle user typing "816259" vs "000000000000816259"
  const sPadded = sQuery.padStart(18, '0');

  const oMatchContext = aContexts.find(oCtx => {
    const sEquipment = oCtx.getProperty("Equipment");
    return sEquipment === sPadded || sEquipment === sQuery;
  });

  if (oMatchContext) {
    this._oManualSearchPopover.close();
    this._highlightItemRow(oMatchContext);
  } else {
    MessageToast.show(
      "Equipment " + sQuery + " not found in this audit. Use 'Add Equipment' to search master data."
    );
  }
},


//────────────────────────────────────────
// Add Equipment
//────────────────────────────────────────
onAddEquipmentOpen: function () {
  this._loadMasterSearchDialog().then(oDialog => {
    oDialog.unbindAggregation("items");
    oDialog.bindAggregation("items", {
      path: "/ZQMM_R_Equip_BarcodeTR",
      template: new StandardListItem({
        title: "{Equipment} - {EquipmentName}",
        description: "{ManufacturerSerialNumber} | {Manufacturer}"
      })
    });
    oDialog.setModel(this.getView().getModel());
    oDialog.open();
  });

},

_loadMasterSearchDialog: function () {
  if (this._oMasterSearchDialog) {
    return Promise.resolve(this._oMasterSearchDialog);
  }
  return Fragment.load({
    id: this.getView().getId(),
    name: this._fragmentPrefix + "MasterSearchDialog",
    controller: this
  }).then(oDialog => {
    this._oMasterSearchDialog = oDialog;
    this.getView().addDependent(oDialog);
    return oDialog;
  });
},

onMasterSearchConfirm: function (oEvent) {
  const oSelectedItem = oEvent.getParameter("selectedItem");
  if (!oSelectedItem) { return; }
  const sEquipment = oSelectedItem.getBindingContext().getProperty("Equipment");
  this._addEquipmentToAudit(sEquipment);
},

onMasterSearch: function (oEvent) {
  const sValue = oEvent.getParameter("value");
  const oBinding = oEvent.getSource().getBinding("items");
  if (!oBinding) { return; }

  oBinding.filter(sValue ? new Filter({
    filters: [
      new Filter("Equipment",               FilterOperator.Contains, sValue),
      new Filter("EquipmentName",           FilterOperator.Contains, sValue),
      new Filter("ManufacturerSerialNumber", FilterOperator.Contains, sValue),
      new Filter("Manufacturer",            FilterOperator.Contains, sValue)
    ],
    and: false
  }) : []);
},

onMasterSearchCancel: function (oEvent) {
  oEvent.getSource().getBinding("items").filter([]);
},


_addEquipmentToAudit: function (sEquipment) {
  // validate against master (already confirmed it exists since we picked from master search)
  // and create a new audit item
  const oHeaderContext = this.getView().getBindingContext();
  const oModel = this.getView().getModel();

  this.base.editFlow.securedExecution(
    () => {
      const oListBinding = oModel.bindList(
        "_AuditItems",
        oHeaderContext,
        [], [],
        { $$updateGroupId: "$auto" }
      );
      // create() returns a Context synchronously
      const oNewItemContext = oListBinding.create({
        Equipment: sEquipment
        // AuditDocId not needed - derived from parent context by the framework
      });

      // .created() returns a Promise that resolves when the backend POST completes
      return oNewItemContext.created();
    },
    {
      updatableObject: oHeaderContext,
      busyControl: this.getView()
    }
  ).then(() => {
    MessageToast.show("Equipment " + sEquipment + " added to audit.");
    this._refreshItemTable();

  }).catch(oErr => {
    MessageBox.error("Could not add equipment: " + oErr.message);
  });
},

_refreshItemTable: function () {
  const oHeaderContext = this.getView().getBindingContext();
  if (oHeaderContext) {
    oHeaderContext.requestSideEffects(["_AuditItems"]);
  }
}



  });
});
