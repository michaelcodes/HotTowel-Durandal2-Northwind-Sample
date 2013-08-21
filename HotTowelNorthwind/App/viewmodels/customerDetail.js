define(['services/logger',
        'plugins/router',
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

    var deleteCustomer = function () {
        var msg = 'Delete customer "' + customer().CompanyName() + '" ?';
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
                router.navigateTo('#/customers');
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
        title: 'Customer',
        customer: ko.observable(),
        canSave: canSave,
        hasChanges: hasChanges,
        goBack: goBack,
        save: save,
        cancel: cancel,
        deleteCustomer: deleteCustomer,
    };

    
    //var serviceName = 'breeze/Breeze';

    //var manager = new breeze.EntityManager(serviceName);
    //var store = manager.metadataStore;
    //var Customer = function () {
    //    this.FirstName = ko.observable('');
    //    this.LastName = ko.observable('');
    //    this.fullName = ko.computed(
    //        function () {
    //            return this.FirstName() + " " + this.LastName();
    //        }, this);
    //};

    //store.registerEntityTypeCtor("Customer", Customer);

    return vm;

    //#region Internal Methods

    function activate(routeData) {
        logger.log('Customer Detail View Activated', null, 'customerDetail', true);
dataContext.getCustomerById(routeData.id);
        return true;
        //vm.customer({});
            //= 
        //return dataContext.getCustomerById(routeData.id)
        //        .then(function (data) {
        //            vm.customer(data.entity);
        //        })
        //        .fail(queryFailed);
    }




    function continueExecution(data) {
        
    }

    function queryFailed(error) {
        toastr.error("Query failed: " + error.message);
    }


    //#endregion


});