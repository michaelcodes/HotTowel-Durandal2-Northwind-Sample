define(['services/logger',
        'plugins/router',
        'services/datacontext'],
function (logger, router, datacontext) {
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

        return datacontext.getOrders()
                .then(function (data) {
                    vm.orders(data.results);
                });
    }

    //#endregion

});