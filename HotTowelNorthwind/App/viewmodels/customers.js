define(['services/logger', 'durandal/plugins/router', 'services/dataContext'],
function (logger, router, dataContext) {
    var vm = {
        activate: activate,
        title: 'Customers',
        customers: ko.observableArray(),
        gotoCustomer: gotoCustomer,
    };

    var serviceName = 'breeze/Breeze';

    //var manager = new breeze.EntityManager(serviceName);
    //var store = manager.metadataStore;
    //var Customer = function () {
    //    this.FirstName = ko.observable('');
    //    this.LastName = ko.observable('');
    //    this.fullName = ko.computed(
    //        function () {
    //            return this.FirstName() + " " + this.LastName();
    //        }, this);S
    //};

    //store.registerEntityTypeCtor("Customer", Customer);

    return vm;

    //#region Internal Methods

    function gotoCustomer(customer) {
        var url = '#/customerDetail/' + customer.CustomerID();
        router.navigateTo(url);
        return false;
    }
    
    function activate() {
        logger.log('Customers View Activated', null, 'customers', true);
        return dataContext.getCustomers()
                .then(querySucceeded)
                .fail(queryFailed);

        
    }

   
    function querySucceeded(data) {
        vm.customers(data.results);
    }

    function queryFailed(error) {
        toastr.error("Query failed: " + error.message);
    }

    //#endregion


});