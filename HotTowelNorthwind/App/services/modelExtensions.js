define(function () {

    return { registerModelExtensions: registerModelExtensions };

    function registerModelExtensions (manager, products) {
        var store = manager.metadataStore;

        var orderDetailInitializer = function (orderDetail) {
            orderDetail.rowtotal = ko.computed(
                function () {
                    return orderDetail.UnitPrice() * parseInt("0" + orderDetail.Quantity(), 10);
                }).money();

            orderDetail.isValid = ko.computed(
                function () {
                    return orderDetail.entityAspect.validateProperty('ProductID') &&
                           orderDetail.entityAspect.validateProperty('UnitPrice') &&
                           orderDetail.entityAspect.validateProperty('Quantity');
                });

            orderDetail.ProductID.subscribe(function (newValue) {
                var product = manager.getEntityByKey("Product", newValue, true);
                if (product) {
                    orderDetail.UnitPrice(product.UnitPrice());
                } else {
                    orderDetail.UnitPrice(0);
                }
            });
        };

        var orderInitializer = function (order) {
            order.grandtotal = ko.computed(function () {
                var total = 0;
                $.each(order.OrderDetails(), function () { total += this.rowtotal(); });
                return total;
            }).money();
        };

        store.registerEntityTypeCtor("OrderDetail", null, orderDetailInitializer);
        store.registerEntityTypeCtor("Order", null, orderInitializer);
    }
    
});