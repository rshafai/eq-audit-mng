sap.ui.define([], function () {
    "use strict";
  
    return {
      isPostToEMRVisible: function (oBindingContext) {
return true;
        // oBindingContext is the page's binding context passed by the framework
        // check supervisor role - since we can't call ABAP from here,
        // use a property exposed on the header entity that indicates the role
        // OR always return true and control visibility via the backend get_features
        // For role-based visibility, we need a helper property on the entity - see note below
        if (!oBindingContext) { return false; }
        return oBindingContext.getProperty("isSupervisor") === true;
      },
  
      isPostToEMREnabled: function (oBindingContext) {
        if (!oBindingContext) { return false; }
        return oBindingContext.getProperty("isCompletable") === true;
      }
    };
  });