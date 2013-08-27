define(['services/logger',
        'plugins/router',
        'services/datacontext',
        'plugins/dialog',
        'durandal/app'],
function (logger, router, datacontext, dialog, app) {
    var isSaving = ko.observable(false);
    var isDeleting = ko.observable(false);

    var activate = function (id) {
        logger.log('Order Detail View Activated', null, 'orderDetail', true);

        var getOrder = datacontext.getOrderById(parseInt(id, 10), vm.order);
        var getProductLookup = datacontext.getProductLookup(vm.productsLookup);
        return Q.all([getProductLookup, getOrder]);
    };

    var editBillAddress = function (customer) {
        var dialogModel = {
            customer: customer,
            viewUrl: 'views/orderSubViews/billingaddress'
        };
        dialogModel.closeDialog = function () {
            dialog.close(this);
        };
        dialog.show(dialogModel);
    };

    var editShipAddress = function (selectedorder) {
        var dialogModel = {
            order: selectedorder,
            viewUrl: 'views/orderSubViews/shippingaddress'
        };
        dialogModel.closeDialog = function () {
            dialog.close(this);
        };
        dialog.show(dialogModel);
    };

    var addOrderLine = function () {
        datacontext.addOrderLine(vm.order().OrderID());
    };

    var goBack = function () {
        router.navigateBack();
    };

    var hasChanges = ko.computed(function () {
        return datacontext.hasChanges();
    });

    var cancel = function () {
        datacontext.cancelChanges();
    };

    var canSave = ko.computed(function () {
        return hasChanges() && !isSaving();
    });

    var save = function () {
        isSaving(true);
        return datacontext.saveChanges().fin(complete);

        function complete() {
            isSaving(false);
        }
    };

    var deleteOrder = function () {
        var msg = 'Delete Order "' + vm.order().OrderID() + '" ?';
        var title = 'Confirm Delete';
        isDeleting(true);
        return app.showMessage(msg, title, ['Yes', 'No'])
            .then(confirmDelete);

        function confirmDelete(selectedOption) {
            if (selectedOption === 'Yes') {
                datacontext.deleteOrder(vm.order())
                    .then(success).fail(failed);
            }
            isDeleting(false);

            function success() {
                router.navigate('#/orders');
            }

            function failed(error) {
                cancel();
                var errorMsg = 'Error: ' + error.message;
                logger.logError(
                    errorMsg, error, system.getModuleId(vm), true);
            }

            
        }

    };

    var canDeactivate = function () {
        if (isDeleting()) { return false; }

        if (hasChanges()) {
            var msg = 'Do you want to leave?';
            var title = 'Navigate away and cancel your changes?';

            return app.showMessage(title, msg, ['Yes', 'No'])
                .then(checkAnswer);
        }
        return true;

        function checkAnswer(selectedOption) {
            if (selectedOption === 'Yes') {
                cancel();
            }
            return selectedOption;
        }
    };

    var deleteOrderLine = function (orderDetail) {
        orderDetail.entityAspect.setDeleted();
    };


    var vm = {
        activate: activate,
        canDeactivate: canDeactivate,
        title: 'order',
        order: ko.observable(),
        productsLookup: ko.observableArray(),
        canSave: canSave,
        hasChanges: hasChanges,
        goBack: goBack,
        save: save,
        cancel: cancel,
        deleteOrder: deleteOrder,
        addOrderLine: addOrderLine,
        editBillAddress: editBillAddress,
        editShipAddress: editShipAddress,
        deleteOrderLine: deleteOrderLine,
    };

    return vm;

});