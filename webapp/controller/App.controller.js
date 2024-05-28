sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/m/MessageToast",
	"sap/m/MessageBox",
	"sap/ui/model/Sorter",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/ui/model/FilterType",
	"sap/ui/model/json/JSONModel"
], function (Controller, MessageToast, MessageBox, Sorter, Filter, FilterOperator, FilterType, JSONModel) {
	"use strict";

	return Controller.extend("sap.ui.core.tutorial.odatav4.controller.App", {

		onInit : function () {
			const oMessageManager = sap.ui.getCore().getMessageManager();
			const oMessageModel = oMessageManager.getMessageModel();
			const oMessageModelBinding = oMessageModel.bindList("/", undefined, [],
					new Filter("technical", FilterOperator.EQ, true)),
				oViewModel = new JSONModel({
					busy : false,
					hasUIChanges : false,
					usernameEmpty : false,
					order : 0
				});
			this.getView().setModel(oViewModel, "appView");
			this.getView().setModel(oMessageModel, "message");

			oMessageModelBinding.attachChange(this.onMessageBindingChange, this);
			this._bTechnicalErrors = false;
		},

		onRefresh : function () {
			const oBinding = this.byId("peopleList").getBinding("items");

			if (oBinding.hasPendingChanges()) {
				MessageBox.error(this._getText("refreshNotPossibleMessage"));
				return;
			}
			oBinding.refresh();
			MessageToast.show(this._getText("refreshSuccessMessage"));
		},
		onSave : function () {
			const fnSuccess = function () {
				this._setBusy(false);
				MessageToast.show(this._getText("changesSentMessage"));
				this._setUIChanges(false);
			}.bind(this);

			const fnError = function (oError) {
				this._setBusy(false);
				this._setUIChanges(false);
				MessageBox.error(oError.message);
			}.bind(this);

			this._setBusy(true); // Lock UI until submitBatch is resolved.
			this.getView().getModel().submitBatch("peopleGroup").then(fnSuccess, fnError);
			this._bTechnicalErrors = false; // If there were technical errors, a new save resets them.
		},
		onCreate : function () {
			const oList = this.byId("peopleList");
			const oBinding = oList.getBinding("items");
			const oContext = oBinding.create({
					"UserName" : "",
					"FirstName" : "",
					"LastName" : "",
					"Age" : ""
				});

			this._setUIChanges();
			this.getView().getModel("appView").setProperty("/usernameEmpty", true);

			oList.getItems().some(function (oItem) {
				if (oItem.getBindingContext() === oContext) {
					oItem.focus();
					oItem.setSelected(true);
					return true;
				}
			});
		},
		onDelete : function () {
           
              const  oPeopleList = this.byId("peopleList");
              const  oSelected = oPeopleList.getSelectedItem();
                
 
            if (oSelected) {
              const  oContext = oSelected.getBindingContext();
              const  sUserName = oContext.getProperty("UserName");
                oContext.delete().then(function () {
                    MessageToast.show(this._getText("deletionSuccessMessage", sUserName));
                }.bind(this), function (oError) {
                    if (oContext === oPeopleList.getSelectedItem().getBindingContext()) {
                        this._setDetailArea(oContext);
                    }
                    this._setUIChanges();
                    if (oError.canceled) {
                        MessageToast.show(this._getText("deletionRestoredMessage", sUserName));
                        return;
                    }
                    MessageBox.error(oError.message + ": " + sUserName);
                }.bind(this));
                this._setDetailArea();
                this._setUIChanges(true);
            }
        },

		onInputChange : function (oEvt) {
			if (oEvt.getParameter("escPressed")) {
				this._setUIChanges();
			} else {
				this._setUIChanges(true);
				if (oEvt.getSource().getParent().getBindingContext().getProperty("UserName")) {
					this.getView().getModel("appView").setProperty("/usernameEmpty", false);
				}
			}
		},

		onSearch : function () {
			const oView = this.getView();
			const sValue = oView.byId("searchField").getValue();
			const Filter = new Filter("LastName", FilterOperator.Contains, sValue);

			oView.byId("peopleList").getBinding("items").filter(oFilter, FilterType.Application);
		},

		onResetChanges : function () {
			this.byId("peopleList").getBinding("items").resetChanges();
			this._bTechnicalErrors = false; 
			this._setUIChanges();
		},

		onResetDataSource : function () {
			const oModel = this.getView().getModel();
			const oOperation = oModel.bindContext("/ResetDataSource(...)");

			oOperation.invoke().then(function () {
					oModel.refresh();
					MessageToast.show(this._getText("sourceResetSuccessMessage"));
				}.bind(this), function (oError) {
					MessageBox.error(oError.message);
				}
			);
		},

		
		onSort : function () {
			const oView = this.getView();
			const aStates = [undefined, "asc", "desc"];
			const aStateTextIds = ["sortNone", "sortAscending", "sortDescending"];
				
				const iOrder = oView.getModel("appView").getProperty("/order");

			iOrder = (iOrder + 1) % aStates.length;
			var sOrder = aStates[iOrder];

			oView.getModel("appView").setProperty("/order", iOrder);
			oView.byId("peopleList").getBinding("items").sort(sOrder && new Sorter("LastName", sOrder === "desc"));

			const sMessage = this._getText("sortMessage", [this._getText(aStateTextIds[iOrder])]);
			MessageToast.show(sMessage);
			},

			onMessageBindingChange : function (oEvent) {
				const aContexts = oEvent.getSource().getContexts();
					
					const	bMessageOpen = false;
	
				if (bMessageOpen || !aContexts.length) {
					return;
				}
	
				// Extract and remove the technical messages
				const aMessages = aContexts.map(function (oContext) {
					return oContext.getObject();
				});
				sap.ui.getCore().getMessageManager().removeMessages(aMessages);
	
				this._setUIChanges(true);
				this._bTechnicalErrors = true;
				MessageBox.error(aMessages[0].message, {
					id : "serviceErrorMessageBox",
					onClose : function () {
						bMessageOpen = false;
					}
				});
	
				bMessageOpen = true;
			},

			onSelectionChange : function (oEvent) {
				this._setDetailArea(oEvent.getParameter("listItem").getBindingContext());
			},


		_getText : function (sTextId, aArgs) {
			return this.getOwnerComponent().getModel("i18n").getResourceBundle().getText(sTextId, aArgs);

		},

		_setUIChanges : function (bHasUIChanges) {
			if (this._bTechnicalErrors) {
				// If there is currently a technical error, then force 'true'.
				bHasUIChanges = true;
			} else if (bHasUIChanges === undefined) {
				bHasUIChanges = this.getView().getModel().hasPendingChanges();
			}
			var oModel = this.getView().getModel("appView");
			oModel.setProperty("/hasUIChanges", bHasUIChanges);
		},
		_setBusy : function (bIsBusy) {
			const oModel = this.getView().getModel("appView");
			oModel.setProperty("/busy", bIsBusy);
		},

		 /**
         * Toggles the visibility of the detail area
         *
         * @param {object} [oUserContext] - the current user context
         */
		 _setDetailArea : function (oUserContext) {
            const oDetailArea = this.byId("detailArea");
			const oLayout = this.byId("defaultLayout");
          
			const oSearchField = this.byId("searchField");
 
            if (!oDetailArea) {
                return; // do nothing when running within view destruction
            }
 
			const oOldContext = oDetailArea.getBindingContext();
            if (oOldContext) {
                oOldContext.setKeepAlive(false);
            }
            if (oUserContext) {
                oUserContext.setKeepAlive(true,
                    // hide details if kept entity was refreshed but does not exists any more
                    this._setDetailArea.bind(this));

            }
 
            oDetailArea.setBindingContext(oUserContext || null);
            // resize view
            oDetailArea.setVisible(!!oUserContext);
            oLayout.setSize(oUserContext ? "60%" : "100%");
            oLayout.setResizable(!!oUserContext);
            oSearchField.setWidth(oUserContext ? "40%" : "20%");
        }
	});


});