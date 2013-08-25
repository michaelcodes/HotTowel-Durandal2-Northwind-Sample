define(['services/logger',
        'plugins/router',
        'services/dataContext'],
function (logger, router, dataContext) {
    var vm = {
        activate: activate,
        title: 'Orders',
        orders: ko.observableArray(),
        gotoOrder: gotoOrder,
    };

    return vm;

    //#region Internal Methods

    function gotoOrder(order) {
        var url = '#/order/' + order.OrderID;
        router.navigate(url);
        return false;
    }

    function activate() {
        logger.log('Orders View Activated', null, 'orders', true);

        return dataContext.getOrders()
                .then(function (data) {
                    vm.orders(data.results);
                });
    }

    //#endregion

});