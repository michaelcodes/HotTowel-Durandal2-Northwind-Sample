define(['services/logger',
        'durandal/plugins/router',
        'services/dataContext'],
function (logger, router, dataContext) {
    var isSaving = ko.observable(false);
    var isDeleting = ko.observable(false);

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

    var vm = {
        activate: activate,
        title: 'order',
        order: ko.observable(),
        canSave: canSave,
        hasChanges: hasChanges,
        goBack: goBack,
        save: save,
        cancel: cancel,
        deleteOrder: deleteOrder,
    };


    //var serviceName = 'breeze/Breeze';

    //var manager = new breeze.EntityManager(serviceName);
    //var store = manager.metadataStore;
    //var order = function () {
    //    this.FirstName = ko.observable('');
    //    this.LastName = ko.observable('');
    //    this.fullName = ko.computed(
    //        function () {
    //            return this.FirstName() + " " + this.LastName();
    //        }, this);
    //};

    //store.registerEntityTypeCtor("order", order);

    return vm;

    //#region Internal Methods

    function activate(routeData) {
        logger.log('Order Detail View Activated', null, 'orderDetail', true);

        return dataContext.getOrderById(parseInt(routeData.id), vm.order)
                
    }



    function continueExecution(data) {

    }

    function queryFailed(error) {
        toastr.error("Query failed: " + error.message);
    }


    //#endregion


});