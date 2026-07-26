sap.ui.define([
    'sap/ui/core/mvc/ControllerExtension',
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/m/StandardListItem",
    "sap/ui/model/Sorter",
    "sap/ui/model/Filter",
	  "sap/ui/model/FilterOperator",
    "sap/ui/model/FilterType",
    "sap/ndc/BarcodeScanner",
    "sap/ui/core/Fragment",
    "sap/ui/model/json/JSONModel"
], function (ControllerExtension, MessageToast, MessageBox, StandardListItem, Sorter, Filter, FilterOperator, FilterType, BarcodeScanner, Fragment, JSONModel) {
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

              let oUIModel = new JSONModel({
                excepMessage: "<p>You can use Exceptions to identify equipment that are not found in SAP.</p>" + 
                              "<p class=\"sapUiLargeMarginBottom\">Please use <strong>Add Equipment</strong> first to search for the equipment in SAP, if found you can add it to the Audit Items list.&nbsp;" + 
                              "If not found then please report it as an Exception.</p>",
                showEdit: false,
                showApprove: false
              });
              this.getView().setModel(oUIModel, "ui");
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
debugger;
                var oTable = this._getItemsTable();
                if (oTable) {
                  oTable.attachSelectionChange(this.onTableSelectionChange, this);
                  oTable.removeSelections(true);
                  oTable.fireSelectionChange();
                }
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
          showEdit = true; 
          showApprove = (sStatus !== "030");  //Audited
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
          ExceptionType:  oEquipData.ExceptionType || ""  
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
    const sEquipment  = this._oDialogModel.getProperty("/Equipment");     //oItemContext.getProperty("Equipment");
    const sActionName = "com.sap.gateway.srvd.zqmm_ui_audit_header.v0001.saveEquipmentChanges";
  
    const buildSingleCall = (fieldName, oldValue, newValue, equipField, bApproveFlag) => {
      return this.base.editFlow.securedExecution(
        () => {
          const oBinding = oModel.bindContext( sActionName + "(...)", oItemContext );
          oBinding.setParameter("FieldName",      fieldName   || "");
          oBinding.setParameter("OldValue",       oldValue    || "");
          oBinding.setParameter("NewValue",       newValue    || "");
          oBinding.setParameter("EquipField",     equipField  || "");
          oBinding.setParameter("Equipment",      sEquipment  || "");
          oBinding.setParameter("EqCondition",    this._oDialogModel.getProperty("/EqCondition")  || "");
          oBinding.setParameter("Comments",       this._oDialogModel.getProperty("/Comments")   || "");
          oBinding.setParameter("ExceptionType",  this._oDialogModel.getProperty("/ExceptionType")  || "");
          oBinding.setParameter("Approve",        !!bApproveFlag);
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
      MessageToast.show(bApproveFlag ? "Item approved." : "Changes saved for Equipment: "+ sEquipment );
      this.onCancelEquipDialog();  //this._oDialog.close();
      this._oItemContext.refresh();
      this._oItemContext.requestSideEffects([  //"EqCondition", "Comments",
        "AuditItemStatus", "AuditItemStatusText", "AuditItemStatusCriticality", "LastChangedAt", "_Change", "_ExceptionType"
      ]);
    }).catch(oErr => { 
      this._oDialog.setBusy(false);
      MessageBox.error((bApproveFlag ? "Approval" : "Save") + " failed: " + oErr.message);
    });
    
  },

  _getInnerTable(){
    const oTable = this._getItemsTable();
    if (oTable){
      return this.base.getView().byId(oTable.getId() + "-innerTable");
    }
  },
  _getItemsTable(){
    const oExtensionAPI = this.base.getExtensionAPI();
    const sTableId = this.base.getView().getId() + "--fe::table::_AuditItems::LineItem"; 
    //gc.agr.aafc.mm.eqauditmng::ZQMM_C_Audit_HeaderObjectPage--fe::table::_AuditItems::LineItem
    //gc.agr.aafc.mm.eqauditmng::ZQMM_C_Audit_HeaderObjectPage--fe::table::_AuditItems::LineItem-innerTable
    return this.base.byId(sTableId);
  },


  onCancelEquipDialog:function(oEvent){
    let oInnerTable = this._getInnerTable();
    if (oInnerTable) {
      oInnerTable.removeSelections();
      oInnerTable.fireSelectionChange();
    }
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
// Barcode Scan - NEW
//────────────────────────────────────────
  onBarcodeScan_OLD: function (sScannedValue) {
debugger;
    this._findEquipmentInAudit(sScannedValue).then(oItem => {
      if (!oItem) {
        MessageToast.show( "Equipment " + sScannedValue + " not found in this audit." );
        return;
      }
      this._showFoundEquipmentStrip(oItem);
    });
  },
  _findEquipmentInAudit: function (sEquipment) {
    const sPadded = sEquipment.padStart(18, '0');
    const oModel = this.getView().getModel();
    const oHeaderContext = this.getView().getBindingContext();

    // targeted read - just check if this equipment exists in this audit
    return oModel.bindList(
      "_Item",
      oHeaderContext,
      [],
      [ new Filter("Equipment", FilterOperator.EQ, sPadded) ],
      { $select: "Equipment,ItemNumber,EquipmentName" }
    ).requestContexts(0, 1).then(aContexts => {
      if (aContexts.length > 0) {
        return aContexts[0].getObject();  // found
      }
      return null;  // not found
    });
  },

  _showFoundEquipmentStrip: function (oItem) {
    const oStrip = this._getOrCreateMessageStrip();
    oStrip.setText(
      "Equipment " + oItem.Equipment.replace(/^0+/, '') +
      " - " + oItem.EquipmentName + " found in this audit."
    );
    oStrip.setVisible(true);
    this._oFoundItem = oItem;  // store for "Go to" handler
  },

  onGoToEquipment: function () {
    if (!this._oFoundItem) { return; }
    this._scrollToEquipment(this._oFoundItem.Equipment);
    this._oMessageStrip.setVisible(false);
    this._oFoundItem = null;
  },

  _scrollToEquipment: function (sEquipment) {
    const sPadded = sEquipment.padStart(18, '0');
    const oTable = this._getItemsTable();
    const oBinding = oTable.getRowBinding();
  
    // check if item is already in loaded contexts
    const aContexts = oBinding.getCurrentContexts();
    const nIndex = aContexts.findIndex(oCtx =>
      oCtx.getProperty("Equipment") === sPadded
    );
  
    if (nIndex >= 0) {
      // already loaded - just scroll and highlight
      this._scrollAndHighlight(oTable, nIndex);
      
    } else {    
      // not yet loaded - need to grow the table until we find it
      this._growUntilFound(oTable, oBinding, sPadded, 0);
    }
  },

  _scrollAndHighlight: function (oTable, nIndex) {
    oTable.scrollToIndex(nIndex);
  
    // highlight after a short delay to allow rendering
    setTimeout(() => {
      const aItems = oTable.getItems();
      if (aItems[nIndex]) {
        this._highlightItemRow(aItems[nIndex].getBindingContext());
      }
    }, 300);
  },

  _growUntilFound: function (oTable, oBinding, sEquipment, nAttempt) {
    const MAX_ATTEMPTS = 10;  // safety limit
    if (nAttempt >= MAX_ATTEMPTS) {
      MessageToast.show("Could not load equipment row — try scrolling to it manually.");
      return;
    }
  
    // request more contexts
    const nCurrentLength = oBinding.getLength();
    oBinding.requestContexts(0, nCurrentLength + 50).then(aContexts => {
      const nIndex = aContexts.findIndex(oCtx =>
        oCtx.getProperty("Equipment") === sEquipment
      );
  
      if (nIndex >= 0) {
        this._scrollAndHighlight(oTable, nIndex);

      } else if (aContexts.length < nCurrentLength + 50) {
        // fetched all available rows, still not found
        MessageToast.show("Equipment loaded but row could not be located.");
      } else {
        // more rows available, keep growing
        this._growUntilFound(oTable, oBinding, sEquipment, nAttempt + 1);
      }
    });
  },




//────────────────────────────────────────
// Barcode Scan - Client search
//────────────────────────────────────────
  onBarcodeScan_OLD: function (oEvent) {
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
        var oTable = this._getItemsTable();

        if (oTable) {
          var oBinding = oTable.getRowBinding();
          if (oBinding) {
            var aContexts = oBinding.getCurrentContexts();
            var oMatchedContext = aContexts.find(function (oContext) {
                return oContext && oContext.getProperty("Equipment") === sBarCode;
            });
            this._highlightItemRow(oMatchedContext, true);  //open Edit dialog
          }
        } else {
          console.error("Could not find table with ID: " + sTableId);
        }
    }
  },

  _highlightItemRow(oContext, bOpenEditDialog){
    if (oContext) {
      var oData = oContext.getObject();
      MessageToast.show("Found Equipment: " + oData.Equipment);

      var oTable = this._getInnerTable();
      
      if (oTable && typeof oTable.getItems === "function") {
        var aItems = oTable.getItems();
        //reset previously highlighted rows
        // $.each(aItems, function(index, row){
        //   row.setHighlight(sap.ui.core.MessageType.None);
        // });
        oTable.removeSelections(true);

        if (oContext){
          var oRowToSelect = aItems.find(function(oItem) {
              return typeof oItem.getBindingContext === "function" && oItem.getBindingContext() === oContext;
          });
          if (oRowToSelect) {
            oRowToSelect.focus();
            // oRowToSelect.setHighlight(sap.ui.core.MessageType.Success); // Highlight the left border green

            // Select the checkbox and open edit/details dialog
            if (typeof oTable.setSelectedItem === "function") {
              oTable.setSelectedItem(oRowToSelect, true);
              oTable.fireSelectionChange();

              if (bOpenEditDialog){
                this._openEditDialog(oContext);
              }
            }
          }
        }
      }
    } else {
        MessageToast.show("Equipment not loaded or not found in this table. You can use 'Add Equipment' to search SAP master data.");
    }
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

onManualSearchClear(oEvent){
  const oUIModel = this.getView().getModel("ui");
  const oTable = this._getItemsTable();
  const oBinding = oTable.getRowBinding(); 
  oBinding.filter([], FilterType.Application);  //FilterType.Application (instead of FilterType.Control) ensures filter coexists with any existing Fiori Elements-managed filters
  oUIModel.setProperty("/filterStar", "");

},

onManualSearchEquipment: function (oEvent) {
  const sQuery = oEvent.getParameter("query").trim();
  const oTable = this._getItemsTable();
  const oBinding = oTable.getRowBinding(); //oTable.getBinding("items");
  const oUIModel = this.getView().getModel("ui");

  // empty search - clear filter and restore full list
  if (!sQuery) {
    oBinding.filter([], FilterType.Application);  //FilterType.Application (instead of FilterType.Control) ensures filter coexists with any existing Fiori Elements-managed filters
    oUIModel.setProperty("/filterStar", "");
    return;
  }

  const sPadded = sQuery.padStart(18, '0');

  oBinding.filter(
    new Filter({
      filters: [
        new Filter("Equipment", FilterOperator.EQ, sPadded),
        new Filter("EquipmentName", FilterOperator.Contains, sQuery)
      ],
      and: false
    }),
    FilterType.Application
  );

  oBinding.attachEventOnce("dataReceived", (oDataEvent) => {
    const aContexts = oBinding.getCurrentContexts();

    if (aContexts.length === 0) {
      // clear the filter - no point showing empty table
      oBinding.filter([], FilterType.Application);  //FilterType.Application (instead of FilterType.Control) ensures filter coexists with any existing Fiori Elements-managed filters
      oUIModel.setProperty("/filterStar", "");
      MessageToast.show( "Equipment " + sQuery + " not found in this audit. You can use 'Add Equipment' to search SAP master data."      );

    } else if (aContexts.length === 1) {
      // exactly one result - select and highlight it
      this._highlightItemRow(aContexts[0], false);   //do not open Edit dialog
      MessageToast.show( "Equipment found. Clear the search field to return to the full list." );
      oUIModel.setProperty("/filterStar", "*");
      //gc.agr.aafc.mm.eqauditmng::ZQMM_C_Audit_HeaderObjectPage--fe::table::_AuditItems::LineItem::CustomAction::ManualSearch-content

    } else {
      // multiple matches (e.g. searched by partial description)
      // table shows all matching rows, user picks visually
      MessageToast.show( aContexts.length + " items found. Clear the search to return to full list." );
      oUIModel.setProperty("/filterStar", "*");

    }
  });
},

onManualSearchEquipment_OLD: function (oEvent) { 
  const sQuery = oEvent.getParameter("query").trim();
  if (!sQuery) { return; }

  const oTable = this._getItemsTable();
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
      "Equipment " + sQuery + " not found in this audit. You can use 'Add Equipment' to search SAP master data."
    );
  }
},


//────────────────────────────────────────
// Add Equipment
//────────────────────────────────────────
onAddEquipmentOpen: function () {
  this._loadMasterSearchDialog().then(oDialog => {
    oDialog.setModel(this.getView().getModel());
    //oDialog.setBindingContext(null);

    oDialog.bindElement({ path: ""  }); //break header context inheritance - "" means start from root

    oDialog.unbindAggregation("items");
    oDialog.bindAggregation("items", {
      path: "/ZQMM_R_Equip_BarcodeTR",
      template: new StandardListItem({
        title: "{Equipment} \u2013 {EquipmentName}",
        description: "{Manufacturer} | {ManufacturerSerialNumber}",
        type: "Active"
      }),
      templateShareable: false
    });
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
      new Filter("Manufacturer",            FilterOperator.Contains, sValue),
      new Filter("CostCenter",              FilterOperator.Contains, sValue),
      new Filter("FunctionalLocation",      FilterOperator.Contains, sValue)
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
},



//────────────────────────────────────────
// Add Exception
//────────────────────────────────────────
onNotInSAPPress: function (oContext, aSelectedContexts) {
  this._loadExceptionDialog().then(oDialog => {
    this._oExceptionModel = new JSONModel({
      manufacturerSerialNo: "",
      manufacturer:         "",
      notes:                ""
    });
    oDialog.setModel(this._oExceptionModel, "exc");
    oDialog.open();
  });
},

_loadExceptionDialog: function () {
  if (this._oExceptionDialog) {
    return Promise.resolve(this._oExceptionDialog);
  }
  return Fragment.load({
    id:         this.getView().getId(),
    name:       this._fragmentPrefix + "ExceptionDialog",
    controller: this
  }).then(oDialog => {
    this._oExceptionDialog = oDialog;
    this.getView().addDependent(oDialog);
    return oDialog;
  });
},

onSaveException: function () {
  const oModel          = this.getView().getModel();
  const oHeaderContext  = this.getView().getBindingContext();
  const sActionName     = "com.sap.gateway.srvd.zqmm_ui_audit_header.v0001.addException";
  const oExcData        = this._oExceptionModel.getData();

  if (!oExcData.manufacturerSerialNo) {
    MessageBox.error("Manufacturer Serial Number is required.");
    return;
  }

  this.base.editFlow.securedExecution(
    () => {
      const oBinding = oModel.bindContext(
        sActionName + "(...)",
        oHeaderContext
      );
      oBinding.setParameter("ManufacturerSerialNo", oExcData.manufacturerSerialNo);
      oBinding.setParameter("Manufacturer",         oExcData.manufacturer);
      oBinding.setParameter("Notes",                oExcData.notes);
      return oBinding.execute();
    },
    {
      updatableObject: oHeaderContext,
      busyControl:     this.getView()
    }
  ).then(() => {
    MessageToast.show("Exception recorded successfully.");
    this._oExceptionDialog.close();
    // refresh the exception table
    oHeaderContext.requestSideEffects(["_AuditException"]);
  }).catch(oErr => {
    MessageBox.error("Could not save exception: " + oErr.message);
  });
},

onCancelException: function () {
  this._oExceptionDialog.close();
}


  });
});
