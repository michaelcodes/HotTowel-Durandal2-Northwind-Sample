define(['services/logger',
        'durandal/plugins/router',
        'services/dataContext'],
function (logger, router, dataContext) {
    var vm = {
        activate: activate,
        title: 'Orders',
        orders: ko.observableArray(),
        gotoOrder: gotoOrder,
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

    function gotoOrder(order) {
        var url = '#/order/' + order.OrderID;
        router.navigateTo(url);
        return false;
    }

    function activate() {
        logger.log('Orders View Activated', null, 'orders', true);
        //this.orders = dataContext.getOrders();
        

        return dataContext.getOrders()
                .then(querySucceeded)
                .fail(queryFailed);


    }


    function querySucceeded(data) {
        vm.orders(data.results);
    }

    function queryFailed(error) {
        toastr.error("Query failed: " + error.message);
    }

    //#endregion

});