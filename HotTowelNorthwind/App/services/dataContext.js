define(['services/logger', 'services/modelExtensions'],
    function (logger, modelExtensions) {
        var EntityQuery = breeze.EntityQuery;
        var manager = new breeze.EntityManager('breeze/Breeze');

        modelExtensions.registerModelExtensions(manager);

        var getCustomers = function () {
            var query = breeze.EntityQuery.
                from("Customers");

            return manager
                .executeQuery(query);
           
        };

        var getProductLookup = function (productsLookup) {
            var query = breeze.EntityQuery
                .from("Products")
                .select("ProductID, ProductName, UnitPrice")
                .orderBy("ProductName");

            return manager
                .executeQuery(query).then(function (data) {
                    productsLookup(data.results);
                });
        }

        var getCustomerById = function (id) {
            return manager
                .fetchEntityByKey("Customer", id, true);
        };

        var getOrders = function () {
            var query = breeze.EntityQuery
                .from("Orders")
                .select("OrderID, OrderDate, Customer.CompanyName")
                .orderBy("OrderID desc")
                .take(100);

            return manager
                .executeQuery(query);

        };

        var getOrderById = function (id, order) {
            var query = breeze.EntityQuery
                .from("Orders")
                .where("OrderID", "==", id)
                .expand("OrderDetails, OrderDetails.Product, Customer");

            return manager
                .executeQuery(query)
                .then(function (data) {
                    order(data.results[0]);
                });
      
        };

        var addOrderLine = function (orderId) {
            return manager.createEntity('OrderDetail', { OrderID: orderId });
        }

        var cancelChanges = function () {
            manager.rejectChanges();
            logger.log('Canceled changes', null, true);
        };

        var saveChanges = function () {
            return manager.saveChanges()
                .then(saveSucceeded)
                .fail(saveFailed);

            function saveSucceeded(saveResult) {
                logger.log('Saved data successfully', saveResult, true);
            }

            function saveFailed(error) {
                var msg = 'Save failed: ' + getErrorMessages(error);
                //logError(msg, error);
                error.message = msg;
                throw error;
            }
        };

        var deleteOrder = function (order) {
            $.each(order.OrderDetails(), function (index, orderDetail) {
                if (orderDetail) {
                    orderDetail.entityAspect.setDeleted();
                }
            });
            order.entityAspect.setDeleted();
            return saveChanges();
        };

        var hasChanges = ko.observable(false);

        manager.hasChangesChanged.subscribe(function (eventArgs) {
            hasChanges(eventArgs.hasChanges);
        });


        return {
            getCustomers: getCustomers,
            getCustomerById: getCustomerById,
            getOrders: getOrders,
            getOrderById: getOrderById,
            getProductLookup: getProductLookup,
            addOrderLine: addOrderLine,
            saveChanges: saveChanges,
            cancelChanges: cancelChanges,
            hasChanges: hasChanges,
            deleteOrder: deleteOrder,
        };
    });