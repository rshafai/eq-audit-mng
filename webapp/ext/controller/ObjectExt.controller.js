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
            }

        }, // override


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
              //oDialog.getModel("itemCtx").setDefaultBindingMode(sap.ui.model.BindingMode.TwoWay);
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




//----------------------------------------------------------------------
    });
});
