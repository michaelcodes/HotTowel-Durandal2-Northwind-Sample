define(function () {

    return { registerModelExtensions: registerModelExtensions };

    function registerModelExtensions (manager) {
        var store = manager.metadataStore;

        var orderDetailInitializer = function (orderDetail) {
            orderDetail.rowtotal = ko.computed(
                function () {
                    return orderDetail.UnitPrice() * parseInt("0" + orderDetail.Quantity(), 10);
                }).money();
        };

        store.registerEntityTypeCtor("OrderDetail", null, orderDetailInitializer);
    }
    
});