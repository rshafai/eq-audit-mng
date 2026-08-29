sap.ui.define([
    "sap/ui/core/mvc/ControllerExtension",
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/m/Table",
    "sap/m/Column",
    "sap/m/ColumnListItem",
    "sap/m/Text",
    "sap/m/SearchField",
    "sap/m/Toolbar",
    "sap/m/ToolbarSpacer",
    "sap/m/Title",
    "sap/m/Label",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/odata/v4/ODataModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (
    ControllerExtension,
    Dialog,
    Button,
    Table,
    Column,
    ColumnListItem,
    Text,
    SearchField,
    Toolbar,
    ToolbarSpacer,
    Title,
    Label,
    JSONModel,
    ODataModel,
    MessageToast,
    MessageBox
) {
	'use strict';

	return ControllerExtension.extend('gc.agr.aafc.mm.eqauditmng.ext.controller.AuditHeaderListExt', {
		// this section allows to extend lifecycle hooks or hooks provided by Fiori elements
		override: {
			/**
             * Called when a controller is instantiated and its View controls (if available) are already created.
             * Can be used to modify the View before it is displayed, to bind event handlers and do other one-time initialization.
             * @memberOf gc.agr.aafc.mm.eqauditmng.ext.controller.AuditHeaderListExt
             */
			onInit: function () {
				// Local model to hold equipment list and selections
                this._oEquipModel = new JSONModel({
                    equipments:         [],
                    filteredEquipments: [],
                    busy:             false
                });
			},
			// Register the custom action button via the
            // Fiori Elements ListReport/ObjectPage extension API
            actionsInitialized: function () {
                // Handled via manifest.json — see section 7
            }
		},  // Override

		// ----------------------------------------------------------------
		// Called from the manifest-registered button
		// ----------------------------------------------------------------
		onCreateNewAuditPressed: function (oEvent) {
            // NOT USED
			this._openEquipmentSelectionDialog();
		},


		// ----------------------------------------------------------------
        // Build and open the Equipment selection dialog
        // ----------------------------------------------------------------
        _openEquipmentSelectionDialog: function () {
            var oView = this.base.getView();

            if (!this._oEquipDialog) {
                // ------ Search bar ------
                var oSearchField = new SearchField({
                    placeholder: "Search Equipment...",
                    liveChange: this._onEquipSearch.bind(this),
                    width: "100%"
                });

                // ------ Equipment table ------
                this._oEquipTable = new Table("equipSelTable", {
                    mode: "MultiSelect",
                    growing: true,
                    growingThreshold: 50,
                    busyIndicatorDelay: 0,
                    columns: [
                        new Column({ header: new Label({ text: "Equipment" }) }),
                        new Column({ header: new Label({ text: "Description" }) }),
                        new Column({ header: new Label({ text: "Equipment Type" }) }),
                        new Column({ header: new Label({ text: "Maint. Plant" }) }),
                        new Column({ header: new Label({ text: "Location" }) }),
					    new Column({ header: new Label({ text: "Func. Location" }) })

                    ]
                });

                this._oEquipTable.bindItems({
                    path:     "/filteredEquipments",
                    model:    "equipModel",
                    template: new ColumnListItem({
                        cells: [
                            new Text({ text: "{equipModel>Equipment}" }),
                            new Text({ text: "{equipModel>EquipmentName}" }),
                            new Text({ text: "{equipModel>TechnicalObjectType}" }),
                            new Text({ text: "{equipModel>MaintPlant}" }),
                            new Text({ text: "{equipModel>Location}" }),
							new Text({ text: "{equipModel>FunctionalLocation}" })
                        ]
                    })
                });

                // ------ Dialog ------
                this._oEquipDialog = new Dialog({
                    title:            "Select Equipment for New Audit",
                    contentWidth:     "70%",
                    contentHeight:    "70%",
                    resizable:        true,
                    draggable:        true,
                    content: [
                        new Toolbar({
                            content: [ oSearchField ]
                        }),
                        this._oEquipTable
                    ],
                    beginButton: new Button({
                        text:    "Create Audit",
                        type:    "Emphasized",
                        press:   this._onCreateAuditConfirmed.bind(this)
                    }),
                    endButton: new Button({
                        text:  "Cancel",
                        press: function () {
                            this._oEquipDialog.close();
                        }.bind(this)
                    }),
                    afterClose: function () {
                        // Clear selections on close
                        this._oEquipTable.removeSelections(true);
                    }.bind(this)
                });

                // Attach local model to the dialog
                this._oEquipDialog.setModel(this._oEquipModel, "equipModel");
                oView.addDependent(this._oEquipDialog);
            }

            // Load equipment data then open
            this._loadEquipments().then(function () {
                this._oEquipDialog.open();
            }.bind(this));
        },

        // ----------------------------------------------------------------
        // Fetch Equipment data via the OData V4 service
        // (I_Equipment is exposed through your service)
        // ----------------------------------------------------------------
        _loadEquipments: function () {
            var oModel = this.base.getView().getModel();
			this._oEquipModel.setProperty("/busy", true);

			var oListBinding = oModel.bindList("/EquipBarcode", null, null, null, {
				$select: "Equipment,EquipmentName,TechnicalObjectType,FunctionalLocation,MaintPlant,Location"
			});

			return oListBinding
				.requestContexts(0, 500)   // start index 0, length 500 — replaces $top
				.then(function (aContexts) {
					var aData = aContexts.map(function (oCtx) {
						return oCtx.getObject();
					});
					this._oEquipModel.setProperty("/equipments",          aData);
					this._oEquipModel.setProperty("/filteredEquipments",  aData);
					this._oEquipModel.setProperty("/busy",                false);
				}.bind(this))
				.catch(function (oError) {
					this._oEquipModel.setProperty("/busy", false);
					MessageBox.error("Failed to load equipment list: " +
						(oError.message || oError));
				}.bind(this));
        },

        // ----------------------------------------------------------------
        // Live search filter on the equipment table
        // ----------------------------------------------------------------
        _onEquipSearch: function (oEvent) {
            var sQuery       = oEvent.getParameter("newValue").toLowerCase();
            var aAll         = this._oEquipModel.getProperty("/equipments");

            var aFiltered = sQuery
                ? aAll.filter(function (oItem) {
                    return (oItem.Equipment    || "").toLowerCase().includes(sQuery) ||
                           (oItem.EquipmentName|| "").toLowerCase().includes(sQuery) ||
						   (oItem.MaintPlant   || "").toLowerCase().includes(sQuery);
                })
                : aAll;

            this._oEquipModel.setProperty("/filteredEquipments", aFiltered);
        },

        // ----------------------------------------------------------------
        // "Create Audit" button inside the dialog
        // ----------------------------------------------------------------
        _onCreateAuditConfirmed: function () {
            var aSelectedItems = this._oEquipTable.getSelectedItems();

            if (!aSelectedItems.length) {
                MessageToast.show("Please select at least one equipment.");
                return;
            }

            // Build comma-separated list of equipment numbers
            var sEquipmentList = aSelectedItems
                .map(function (oItem) {
                    var oCtx = oItem.getBindingContext("equipModel");
                    return oCtx.getProperty("Equipment");
                })
                .join(",");

            this._oEquipDialog.setBusy(true);
            this._invokeCreateAuditAction(sEquipmentList);
        },

        // ----------------------------------------------------------------
        // Call the RAP action CreateAudit via OData V4
        // ----------------------------------------------------------------
        _invokeCreateAuditAction: function (sEquipmentList) {
            var oModel       = this.base.getView().getModel();
debugger;
			// 1. Create a list binding for the entity set — needed to get the header context
			//    which serves as the binding context for a static (unbound) action
			var oListBinding = oModel.bindList("/ZQMM_C_Audit_Header");

			// 2. The fully qualified action name is:
			//    <Schema Namespace from $metadata>.<Action Name>
			//    For a static action it is called on the entity set, so we bind it
			//    to the header context of the list binding
			var sFQActionName = "com.sap.gateway.srvd.zqmm_ui_audit_header.v0001.CreateAudit(...)";
			//                   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
			//                   The (...) suffix is required — it tells UI5 this is an action/function

			var oActionBinding = oModel.bindContext(
				sFQActionName,
				oListBinding.getHeaderContext()  // header context = entity set level = correct for static actions
			);
			
			// 3. Set the action parameter(s)
    		oActionBinding.setParameter("EquipmentList", sEquipmentList);			

			// 4. Execute and handle the result
			oActionBinding.execute()
				.then(function () {
					this._oEquipDialog.setBusy(false);
					this._oEquipDialog.close();
					MessageToast.show("Audit created successfully!");

					// Refresh the list binding to show the newly created record
					this.base.getView().byId("fe::table::ZQMM_C_Audit_Header::LineItem")
						.getBinding("items")
						.refresh();
				}.bind(this))
				.catch(function (oError) {
					this._oEquipDialog.setBusy(false);
					// OData V4 error messages are nested under oError.error
					var sMsg = (oError.error && oError.error.message)
						? oError.error.message
						: (oError.message || "Unknown error occurred");
					MessageBox.error("Failed to create audit: " + sMsg);
				}.bind(this));


        //     // For a static action the operation binding is on the collection
        //     var oActionBinding = oListBinding.getHeaderContext().requestObject()
        //         .then(function () {
        //             // Bind the static action at the entity set level
        //             var oOpBinding = oModel.bindContext(
        //                 "com.sap.gateway.default.zapi_audit_header.v0001" +
        //                 ".CreateAudit(...)",   // <-- replace namespace with yours
        //                 oListBinding.getHeaderContext()
        //             );

        //             // Set the action parameter
        //             oOpBinding.setParameter("EquipmentList", sEquipmentList);

        //             return oOpBinding.execute();
        //         }.bind(this))
        //         .then(function () {
        //             this._oEquipDialog.setBusy(false);
        //             this._oEquipDialog.close();
        //             MessageToast.show("Audit created successfully!");

        //             // Refresh the list to show the new record
        //             this.base.getView().getModel().refresh();
        //         }.bind(this))
        //         .catch(function (oError) {
        //             this._oEquipDialog.setBusy(false);
        //             var sMsg = oError.error
        //                 ? oError.error.message
        //                 : (oError.message || "Unknown error");
        //             MessageBox.error("Failed to create audit: " + sMsg);
        //         }.bind(this));
        }

    }); // end ControllerExtension.extend
});
