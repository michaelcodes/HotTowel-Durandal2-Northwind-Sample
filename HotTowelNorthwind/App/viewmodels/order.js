define(['services/logger',
        'plugins/router',
        'services/dataContext',
        'plugins/dialog'],
function (logger, router, dataContext, dialog) {
    var isSaving = ko.observable(false);
    var isDeleting = ko.observable(false);




    var vm = {
        activate: activate,
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
        testvalue: ko.observable(4500.10).money(),
        editBillAddress: editBillAddress,
        editShipAddress: editShipAddress,
        deleteOrderLine: deleteOrderLine
    };


    return vm;

    //#region Internal Methods

    function editBillAddress(customer) {
        var dialogModel = {
            customer: customer,
            viewUrl: 'views/billingaddress'
        }
        dialogModel.closeDialog = function () {
            dialog.close(this);
        };
        dialog.show(dialogModel);
    }

    function editShipAddress(selectedorder) {
        var dialogModel = {
            order: selectedorder,
            viewUrl: 'views/shippingaddress'
        }
        dialogModel.closeDialog = function () {
            dialog.close(this);
        };
        dialog.show(dialogModel);
    }

    function activate(id) {
        logger.log('Order Detail View Activated', null, 'orderDetail', true);

        var getOrder = dataContext.getOrderById(parseInt(id), vm.order);
        var getProductLookup = dataContext.getProductLookup(vm.productsLookup);
        return Q.all([getProductLookup, getOrder]);
                
    }

    function addOrderLine() {
        dataContext.addOrderLine(vm.order().OrderID());
    };

    function queryFailed(error) {
        toastr.error("Query failed: " + error.message);
    }


















    var goBack = function () {
        router.navigateBack();
    };

    var hasChanges = ko.computed(function () {
        return dataContext.hasChanges();
    });

    var cancel = function () {
        dataContext.cancelChanges();
    };

    var canSave = ko.computed(function () {
        return hasChanges() && !isSaving();
    });

    var save = function () {
        isSaving(true);
        return dataContext.saveChanges().fin(complete);

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
                session().entityAspect.setDeleted();
                save().then(success).fail(failed).fin(finish);
            }
            isDeleting(false);

            function success() {
                router.navigateTo('#/orders');
            }

            function failed(error) {
                cancel();
                var errorMsg = 'Error: ' + error.message;
                logger.logError(
                    errorMsg, error, system.getModuleId(vm), true);
            }

            function finish() {
                return selectedOption;
            }
        }

    };

    var canDeactivate = function () {
        if (isDeleting()) { return false; }

        if (hasChanges()) {
            var title = 'Do you want to leave "' +
                session().title() + '" ?';
            var msg = 'Navigate away and cancel your changes?';

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
    //#endregion


});