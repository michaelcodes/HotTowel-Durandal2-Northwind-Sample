﻿define(['services/logger',
        'services/modelextensions',
        'durandal/system'],
    function (logger, modelextensions, system) {
        var EntityQuery = breeze.EntityQuery,
            manager = new breeze.EntityManager('breeze/Breeze'),
            hasChanges = ko.observable(false);

        var setupCustomValidators = function () {
            var minQty = new breeze.Validator(
                "minQty",                       // validator name
                function (value, context) {     // validation function
                    return value > 0;
                },
                {                               // validator context
                    messageTemplate: "'%displayName%' must be greater than 0"
                });
            var employeeType = manager.metadataStore.getEntityType("OrderDetail");
            employeeType
                .getProperty("Quantity")
                .validators.push(minQty);

        };

        modelextensions.registerModelExtensions(manager);
        manager.fetchMetadata().then(setupCustomValidators);
        manager.hasChangesChanged.subscribe(function (eventArgs) {
            hasChanges(eventArgs.hasChanges);
        });


        var getProductLookup = function (productsLookup) {
            var query = breeze.EntityQuery
                .from("Products")
                .orderBy("ProductName");

            return manager
                .executeQuery(query).then(function (data) {
                    productsLookup(data.results);
                });
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
            return manager.createEntity('OrderDetail', { OrderID: orderId, Quantity: 1 });
        };

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
                logError(msg, error);
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


        return {
            hasChanges: hasChanges,
            getOrders: getOrders,
            getOrderById: getOrderById,
            getProductLookup: getProductLookup,
            addOrderLine: addOrderLine,
            saveChanges: saveChanges,
            cancelChanges: cancelChanges,
            deleteOrder: deleteOrder,
        };


        function getErrorMessages(error) {
            var msg = error.message;
            if (msg.match(/validation error/i)) {
                return getValidationMessages(error);
            }
            return msg;
        }

        function getValidationMessages(error) {
            try {
                //foreach entity with a validation error
                return error.entitiesWithErrors.map(function (entity) {
                    // get each validation error
                    return entity.entityAspect.getValidationErrors().map(function (valError) {
                        // return the error message from the validation
                        return valError.errorMessage;
                    }).join('; <br/>');
                }).join('; <br/>');
            }
            catch (e) { }
            return 'validation error';
        }

        function logError(msg, error) {
            logger.logError(msg, error, 'datacontext', true);
        }


    });