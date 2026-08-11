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
          onListNavigationExtension: function (oEvent) {
            debugger;
          },
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
                // showEdit: false,
                // showApprove: false
              });
              this.getView().setModel(oUIModel, "ui");
            },


            onAfterRendering: function() {
              const oTable = this._getItemsTable(true); // get inner table
              
              if (oTable && !this._bTableListenerAttached) {
                  // Attach to the table's native data update loop to implement row select
                  oTable.attachUpdateFinished(this.onTableUpdateFinished, this);
                  this._bTableListenerAttached = true; 
              }
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
                let oTable = this._getItemsTable();
                if (oTable && !this._bSelectionAttached) {
                  //Selection change event
                  oTable.attachSelectionChange(this.onTableSelectionChange, this);
                  this._bSelectionAttached = true;

                  // //Make rows clickable
                  // oTable = this._getItemsTable(true);  //get inner table
                  // var that = this;
                  // if (oTable && !this._bRowPressAttached) {
                  //   oTable.attachEventOnce("itemPress", this.onItemRowPress, this);
                  //   this._bRowPressAttached = true;  // attach once only
                  //   oTable.addEventDelegate({
                  //     onAfterRendering: function() {
                  //       var aItems = oTable.getItems();
                  //       aItems.forEach(function(oItem) {
                  //           if (oItem.setType) {
                  //               oItem.setType("Navigation"); // Forces cursor pointer and active click styles
                  //               oItem.attachEventOnce("press", function(oEvent){
                  //                 that.onItemRowPress(oEvent);
                  //               });
                  //           }
                  //       });
                  //     }
                  //   });
                  // }


                  //Initialize table
                  this.onClearSearchFilter();
                }
            }

          } // routing
        }, // override

  onTableUpdateFinished: function(oEvent) {
      const oTable = oEvent.getSource();
      var aItems = oTable.getItems();
      var that = this;
  
      aItems.forEach(function(oItem) {
          // Only attach to rows that haven't been processed yet
          if (oItem && !oItem._bCustomClickBound) {
              
              if (oItem.setType) {
                oItem.setType("Navigation");
              }  
              // 2. Attach a simple, isolated click listener to the row
              oItem.addEventDelegate({
                  onclick: function(oBrowserEvent) {
                    //if user clicked on the checkbox, let it go  
                    //var bClickedOnCheckbox = jQuery(oBrowserEvent.target)[0].innerHTML.indexOf("CheckBox")>=0; //jQuery(oBrowserEvent.target).closest(".sapMListTOC").length > 0;
                    let oClickedControl = oBrowserEvent.srcControl || sap.ui.getCore().byId(oBrowserEvent.target.id);
                    if (oClickedControl) {
                        let sMetadataName = oClickedControl.getMetadata().getName();   //'sap.m.CheckBox'
                        if (sMetadataName.indexOf("CheckBox") >= 0 || sMetadataName.indexOf("SelectionCell") >= 0) {
                            return;
                        }
                    }
                    //stop normal click behaviour
                    oBrowserEvent.stopPropagation();
                    oBrowserEvent.preventDefault();
                    //open edit item dialog
                    that.onItemRowPress(oItem);
                  }
              }, that);
              oItem._bCustomClickBound = true; // Lock the row so we never double-bind it
          }
      });
  },
  onItemRowPress: function (oClickedRow) {
    var oRowContext = oClickedRow.getBindingContext();
    if (!oRowContext) { return; }
  
    // open edit dialog
    this._bApprovalMode = false;
    this.getView().setBusy(true);
    this._openEditDialog(oRowContext);
  },

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

  
  _getItemsTable(bInner){
    const oExtensionAPI = this.base.getExtensionAPI();
    let sTableId = this.base.getView().getId() + "--fe::table::_AuditItems::LineItem"; 
    if (bInner) {
      sTableId += "-innerTable"
    }
    return this.base.byId(sTableId);
    //gc.agr.aafc.mm.eqauditmng::ZQMM_C_Audit_HeaderObjectPage--fe::table::_AuditItems::LineItem
    //gc.agr.aafc.mm.eqauditmng::ZQMM_C_Audit_HeaderObjectPage--fe::table::_AuditItems::LineItem-innerTable
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
            initialValue:       sPrefillValue,  // changes made in this session
            equipField:         cfg.EquipField,
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

  onCancelEquipDialog:function(oEvent){
    let oInnerTable = this._getItemsTable(true);
    if (oInnerTable) {
      oInnerTable.removeSelections();
      oInnerTable.fireSelectionChange();
    }
    if (this._oDialog){
        this._oDialog.close();
    }
  },

  
  formatColumns: function(sStatus) {
      return "Information"; //"Error"
  },

  
//────────────────────────────────────────
// Save Equipment Changes to Item
//────────────────────────────────────────
  onSaveAndApprove: function(oEvent){
    this._saveEquipChanges(true); // pass Approve = true through
  },
  
  onSaveEquipChanges: function () {
    this._saveEquipChanges(false);
  },

  _saveEquipChanges: function (bApproveFlag) {
    const aRows = this._oDialogModel.getProperty("/fields");
    const aChangedRows = aRows.filter(r => r.newValue !== r.initialValue);   //only save fields that changed in this session

    const oModel = this.getView().getModel();
    const oItemContext = this._oItemContext;
    const oHeaderContext = this.getView().getBindingContext();
    const sException  = this._oDialogModel.getProperty("/ExceptionType");     
    const sComments   = this._oDialogModel.getProperty("/Comments");     
    const sEquipment  = this._oDialogModel.getProperty("/Equipment");   
    const sActionName = "com.sap.gateway.srvd.zqmm_ui_audit_header.v0001.saveEquipmentChanges";
  
    //Validations
    if (sException && sException !=='000' && !sComments) {
      MessageBox.error( "Comments are required when an Exception Type is selected." );
      return;  
    }

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
          oBinding.setParameter("Comments",       sComments   || "");
          oBinding.setParameter("ExceptionType",  sException  || "");
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
          row.fieldName, row.oldValue, row.newValue, row.equipField, i === 0 ? bApproveFlag : false
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
      // this._oItemContext.requestSideEffects([  "EqCondition", "Comments",
      //   "AuditItemStatus", "AuditItemStatusText", "AuditItemStatusCriticality", "LastChangedAt", "_Change", "_ExceptionType"
      // ]);
      oHeaderContext.refresh();
      // oHeaderContext.requestSideEffects([   //doesnt work in on-prem when operation was at item level 
      //   "AuditHeaderStatus",
      //   "_AuditItems"
      // ]);
    }).catch(oErr => { 
      this._oDialog.setBusy(false);
      MessageBox.error((bApproveFlag ? "Approval" : "Save") + " failed: " + oErr.message);
    });
    
  },

  
//────────────────────────────────────────
// Validate against EMR
//────────────────────────────────────────
onValidateEquipChanges: function () {
  const aRows = this._oDialogModel.getProperty("/fields");
  const aChangedRows = aRows.filter(r => r.newValue !== r.oldValue);  //validate only fields that have different values than master data

  if (aChangedRows.length === 0) {
    MessageToast.show("No changes to validate.");
    return;
  }

  const oModel        = this.getView().getModel();
  const oItemContext  = this._oItemContext;
  const sActionName   = "com.sap.gateway.srvd.zqmm_ui_audit_header.v0001.validateEquipmentChanges";

  sap.ui.getCore().getMessageManager().removeAllMessages();

  this.base.editFlow.securedExecution(
    () => {
      // chain all validations sequentially inside one securedExecution
      // so lock is acquired once and held for all calls
      return aChangedRows.reduce((oPromise, r) => {
        return oPromise.then(() => {
          const oBinding = oModel.bindContext(
            sActionName + "(...)",
            oItemContext
          );
          oBinding.setParameter("FieldName",      r.fieldName        || "");
          oBinding.setParameter("OldValue",       r.oldValue         || "");
          oBinding.setParameter("NewValue",       r.newValue         || "");
          oBinding.setParameter("EquipField",     r.equipField   || "");
          oBinding.setParameter("Equipment",      oItemContext.getProperty("Equipment") || "");
          oBinding.setParameter("EqCondition",    this._oDialogModel.getProperty("/eqCondition") || "");
          oBinding.setParameter("Comments",       this._oItemContext.getProperty("Comments") || "");
          oBinding.setParameter("ExceptionType",  this._oDialogModel.getProperty("/ExceptionType") || "");
          oBinding.setParameter("Approve",        false);
          return oBinding.execute();
        });
      }, Promise.resolve());
    },
    { 
      updatableObject: oItemContext,
      busyControl: this.getView()
    }
  ),then(() => {
    const aMessages = sap.ui.getCore()
      .getMessageManager()
      .getMessageModel()
      .getData();

    const aErrors = aMessages.filter(m => m.type === "Error" || m.type === "error");

    if (aErrors.length === 0) {
      MessageBox.success(
        "All changed values validated successfully.\n\nNo errors found.",
        { title: "Validation Passed" }
      );
    }
    // errors are already shown by securedExecution in the message popover
  });
},



//────────────────────────────────────────
// Value Help
//────────────────────────────────────────
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

//────────────────────────────────────────  
// Approve Multiple Items
//────────────────────────────────────────
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
    const oHeaderContext = this.getView().getBindingContext();

    const aCalls = aContexts.map(oCtx => {
      const oBinding = oModel.bindContext(
                          "com.sap.gateway.srvd.zqmm_ui_audit_header.v0001.approveItems(...)",
                          oCtx
      );
      return oBinding.execute();  
    });
    Promise.all(aCalls).then(() => {
      MessageToast.show("Items approved.");
      this._oItemContext.requestSideEffects([
        "AuditItemStatus", "_AuditChange"
      ]);
      oHeaderContext.refresh();
      // oHeaderContext.requestSideEffects([  //doesn't work in on-prem
      //   "_AuditItems",
      //   "AuditHeaderStatus"   
      // ]);
    }).catch(oErr => {
      MessageBox.error("Approval failed: " + oErr.message);
    });
  },

  


//────────────────────────────────────────
// Barcode Scan 
//────────────────────────────────────────
  onBarcodeScan: function (oEvent) {
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
      var sEquipment = mResult.text;
      var oExtensionAPI = this.base.getExtensionAPI();
      var oTable = this._getItemsTable();

      // Search the item table first
      if (oTable) {
        var oBinding = oTable.getRowBinding();   //only searches the portion that is loaded in current page
        if (oBinding) {
          var aContexts = oBinding.getCurrentContexts();
          var oMatchedContext = aContexts.find(function (oContext) {
              return oContext && oContext.getProperty("Equipment") === sEquipment;
          });
        }
      } 
      if (oMatchedContext){
        //already loaded in current page
        this._highlightItemRow(oMatchedContext, true);  //true: open Edit dialog

      } else {
        this._itemSearchServer(sEquipment);
      }
    }
  },

  _showFoundEquipmentStrip: function (oItem) {
    //Not used
    const sDisplayEquip = oItem.Equipment.replace(/^0+/, '');
    MessageBox.information(
      "Equipment " + sDisplayEquip + " - " + oItem.EquipmentName +
      " was found in this audit.",
      {
        title: "Equipment Found",
        actions: ["Go to Equipment", MessageBox.Action.CLOSE],
        onClose: (sAction) => {
          if (sAction === "Go to Equipment") {
            this._scrollToEquipment(oItem.Equipment);
          }
        }
      }
    );
  },

  _highlightItemRow(oContext, bOpenEditDialog){
    if (oContext) {
      var oData = oContext.getObject();
      MessageToast.show("Found Equipment: " + oData.Equipment);

      var oTable = this._getItemsTable(true);
      
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
// Search for Equipment in the item table - Server side search
//────────────────────────────────────────
_itemSearchServer: function(sEquipment){
  //gc.agr.aafc.mm.eqauditmng::ZQMM_C_Audit_HeaderObjectPage--fe::table::_AuditItems::LineItem::StandardAction::BasicSearch
    var oTable = this._getItemsTable();
    var oRowBinding = oTable.getRowBinding();
    if (oRowBinding) {
      this._bBarCodeSearch = true;
      oRowBinding.detachEvent("change", this._onTableDataChanged, this);
      oRowBinding.attachEvent("change", this._onTableDataChanged, this);
      //oRowBinding.attachEvent("dataReceived", this._onTableDataReceived, this);

      //Force trigger item search
      oRowBinding.changeParameters({ "$search": sEquipment});  //force trigger search 
    }
},

_onTableDataChanged: function(oEvent){
  if (this._bBarCodeSearch === false){ return; }
  this._bBarCodeSearch = false;

  const oBinding = oEvent.getSource();
  if (oBinding && typeof oBinding.getLength === "function") {
    const iCount = oBinding.getLength();
    oBinding.detachEvent("change", this._onTableDataChanged, this);

    if (iCount === 1){
      this._highlightItemRow(oBinding.getCurrentContexts()[0], false);  //open dialog
    } else {
      if (iCount === 0){
        // Not in Item table
        const sEquipment = oEvent.getSource().getQueryOptionsFromParameters().$search;
        // clear the search filter first so the table is restored
        oBinding.changeParameters({ "$search": undefined }); 

        MessageBox.confirm( this._readi18n("BarcodeNotFound", sEquipment ), 
          {
            title: "Equipment Not Found",
            contentWidth: "500px",
            actions: ["Retry Scan", "Search SAP",  MessageBox.Action.CANCEL],
            emphasizedAction: "Retry Scan",
            onClose: (sAction) => {
              if (sAction === "Search SAP") {
                // reuse existing master data search dialog
                // pre-populate with the scanned equipment number
                this._openMasterSearchWithEquipment(sEquipment);

              } else if (sAction === "Retry Scan") {
                MessageToast.show("Ready to scan. Please scan the barcode again.");
                this.onBarcodeScan();
              }
              // CANCEL: do nothing, table already restored 
            }
          }
        );

      }  //count=0
    } 
  } // count=1
},



_openMasterSearchWithEquipment: function (sEquipment) {
  this._loadMasterSearchDialog().then(oDialog => {
    oDialog.setModel(this.getView().getModel());
    oDialog.bindElement({ path: "" });

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

    // pre-filter with the scanned value after dialog opens
    // give it a tick to render first
    setTimeout(() => {
      const oItemsBinding = oDialog.getBinding("items");
      if (oItemsBinding) {
        oItemsBinding.filter([
          new Filter({
            filters: [
              new Filter("Equipment",               FilterOperator.Contains, sEquipment),
              //new Filter("EquipmentName",           FilterOperator.Contains, sEquipment),
              new Filter("ManufacturerSerialNumber", FilterOperator.Contains, sEquipment)
            ],
            and: false
          })
        ]);
      }
    }, 100);
  });
},




onClearSearchFilter: function (oEvent, aContexts)  {
  // 1. Visual Fix: Turn the text button into an icon on the fly
  const oTable = this._getItemsTable();
  const sButtonId =  oTable.getId() + "::CustomAction::ClearSearchFilterAction";
  var oButton = this.getView().byId(sButtonId) || sap.ui.getCore().byId(sButtonId);
  if (oButton && typeof oButton.setIcon === "function") {
    oButton.setIcon("sap-icon://refresh");
    oButton.setText(""); 
  }

  var oRowBinding = oTable.getRowBinding();
  if (oRowBinding) {
        oRowBinding.changeParameters({
            "$search": undefined
        });
        MessageToast.show("Table filters reset successfully.");
  }
},



//────────────────────────────────────────
// Post to EMR, Complete Audit Header
//────────────────────────────────────────
onPostAuditDocument: function (oContext) {
  const oHeaderContext = this.getView().getBindingContext();
  const oModel = this.getView().getModel();
  const sActionName = "com.sap.gateway.srvd.zqmm_ui_audit_header.v0001.postToEMR";

  this.getView().setBusy(true);

  const oItemsBinding = oModel.bindList(
    "_AuditItems",
    oHeaderContext,
    [],
    [ new Filter("AuditItemStatus", FilterOperator.EQ, "030") ]
  );
  
  oItemsBinding.requestContexts(0, 999).then(aContexts => {
    this.getView().setBusy(false);
    const nCount = aContexts.length;
  
    const sConfirmText = ( nCount === 0 )
      ? "No items are in Audited status.\n\n"
      : nCount === 1
        ? "1 item is in Audited status and will be processed.\n\nDo you want to post to Equipment Master?"
        : `${nCount} items are in Audited status and will be processed.\n\nDo you want to post to Equipment Master?`;
  
    MessageBox.confirm(sConfirmText, {
      title: "Confirm Post to Equipment Master",
      actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
      emphasizedAction: MessageBox.Action.OK,
      onClose: (sAction) => {
        if (sAction !== MessageBox.Action.OK) { return; }
        if (nCount > 0){
          this._executePostToEMR();
        }
      }
    });
  }).catch(() => {
    this.getView().setBusy(false);
    MessageBox.error("Could not retrieve audit item information.");
  });
},

_executePostToEMR: function () {
  const oHeaderContext = this.getView().getBindingContext();
  const oModel = this.getView().getModel();
  const sActionName = "com.sap.gateway.srvd.zqmm_ui_audit_header.v0001.postToEMR";

  

  this.base.editFlow.securedExecution(
    () => {
      sap.ui.getCore().getMessageManager().removeAllMessages();
      const oBinding = oModel.bindContext(
        sActionName + "(...)",
        oHeaderContext
      );
      return oBinding.execute();
      // no .then() needed - framework handles success/error messages
    },
    {
      updatableObject: oHeaderContext,
      busyControl: this.getView()
    }
  ).then(() => {
    // action succeeded - framework already showed the success message
    // just refresh side effects
    oHeaderContext.refresh();
  });
  // no .catch() at all - securedExecution handles error display automatically
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
  const oHeaderContext = this.getView().getBindingContext();
  const oModel = this.getView().getModel();

  this.getView().setBusy(true);

  const oListBinding = oModel.bindList(
    "_AuditItems",
    oHeaderContext,
    [], [],
    { $$updateGroupId: "$auto" }
  );

  sap.ui.getCore().getMessageManager().removeAllMessages();

  // attach createCompleted BEFORE calling create
  // this is the official documented way to handle create errors in V4
  oListBinding.attachEventOnce("createCompleted", (oEvent) => {
    const bSuccess = oEvent.getParameter("success");
    this.getView().setBusy(false);

    if (bSuccess) {
      MessageToast.show("Equipment " + sEquipment + " added to audit.");
      oHeaderContext.requestSideEffects(["_AuditItems"]);
    } else {
      // delete the failed transient context to stop retry loop
      oNewItemContext.delete("$auto").catch(() => {});

      // error message is already in the MessageManager - show it
      const aMessages = sap.ui.getCore().getMessageManager().getMessageModel().getData();
      const oError = aMessages.filter(m => m.type === "Error").pop();

      MessageBox.error( oError ? oError.message : "Could not add equipment." );
    }
  });

  const oNewItemContext = oListBinding.create({
    Equipment: sEquipment
  });
},




//────────────────────────────────────────
// Add Exception
//────────────────────────────────────────
onNotInSAPPress: function (oContext, aSelectedContexts) {
  this._loadExceptionDialog().then(oDialog => {
    this._oExceptionModel = new JSONModel({
      eqCondition: "",
      comments:    ""
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
  const sActionName     = "com.sap.gateway.srvd.zqmm_ui_audit_header.v0001.addNotInSAP";
  const oExcData        = this._oExceptionModel.getData();

  if (!oExcData.eqCondition || !oExcData.comments) {
    MessageBox.error("Equipment Condition and Comments are required.");
    return;
  }

  // clear existing messages before the action call
  // so we only check messages generated by THIS specific call
  sap.ui.getCore().getMessageManager().removeAllMessages();

  this.base.editFlow.securedExecution(
    () => {
      const oBinding = oModel.bindContext(
        sActionName + "(...)",
        oHeaderContext
      );
      oBinding.setParameter("EqCondition", oExcData.eqCondition);
      oBinding.setParameter("Comments",    oExcData.comments || "");
      return oBinding.execute();
    },
    {
      updatableObject: oHeaderContext,
      busyControl:     this.getView()
    }
  ).then(() => {
    const aErrors = sap.ui.getCore()
      .getMessageManager()
      .getMessageModel()
      .getData()
      .filter(m => m.type === "Error" || m.type === "error");

    if (aErrors.length > 0) {
      // backend returned errors - framework shows them, we stay silent
      return;
    }
    MessageToast.show("Exception item added successfully.");
    this._oExceptionDialog.close();
    oHeaderContext.requestSideEffects(["_AuditItems"]);

  }).catch(oErr => {
    MessageBox.error("Could not add exception item: " + oErr.message);
  });
},

onCancelException: function () {
  this._oExceptionDialog.close();
},



_readi18n: function(tag, v1, v2){
  const oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
  return oResourceBundle.getText(tag, [v1, v2]); 
  
},


  });
});
