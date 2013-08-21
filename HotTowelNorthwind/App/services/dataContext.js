define(['services/logger'],
    function (logger) {
        var EntityQuery = breeze.EntityQuery;
        var manager = new breeze.EntityManager('breeze/Breeze');
  

        var getCustomers = function () {
            var query = breeze.EntityQuery.
                from("Customers");

            return manager
                .executeQuery(query);
           
        };

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
                .expand("OrderDetails, OrderDetails.Product");

            return manager
                .executeQuery(query)
                .then(function (data) {
                    order(data.results[0]);
                });
      
        };

        var cancelChanges = function () {
            manager.rejectChanges();
            log('Canceled changes', null, true);
        };

        var saveChanges = function () {
            return manager.saveChanges()
                .then(saveSucceeded)
                .fail(saveFailed);

            function saveSucceeded(saveResult) {
                log('Saved data successfully', saveResult, true);
            }

            function saveFailed(error) {
                var msg = 'Save failed: ' + getErrorMessages(error);
                logError(msg, error);
                error.message = msg;
                throw error;
            }
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
            saveChanges: saveChanges,
            cancelChanges: cancelChanges,
            hasChanges: hasChanges
        };
    });