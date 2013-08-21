define(['durandal/system', 'durandal/plugins/router', 'services/logger'],
    function (system, router, logger) {
        var shell = {
            activate: activate,
            router: router
        };
        
        return shell;

        //#region Internal Methods
        function activate() {
            return boot();
        }

        function boot() {
            router.mapNav('home');
            router.mapNav('details');
            router.mapNav('customers');
            router.mapNav('orders');
            router.mapRoute('customerDetail/:id');
            router.mapRoute('order/:id');
            //var routes = [{
            //    url: 'home',
            //    moduleId: 'viewmodels/home',
            //    name: 'Home',
            //    visible: true,
            //    caption: 'Home',
            //}, {
            //    url: 'details',
            //    moduleId: 'viewmodels/details',
            //    name: 'Details',
            //    caption: 'Details',
            //    visible: true,
            //}, {
            //    url: 'customers',
            //    moduleId: 'viewmodels/customers',
            //    name: 'Customers',
            //    caption: 'Customers',
            //    visible: true
            //}, {
            //    url: 'customerDetail/:id',
            //    moduleId: 'viewmodels/customerDetail',
            //    name: 'Customer Detail',
            //    visible: false,
            //    caption: 'Customer Detail',
            //}];
            //router.map(routes);
            log('Hot Towel SPA Loaded!', null, true);
            return router.activate('home');
        }

        function log(msg, data, showToast) {
            logger.log(msg, data, system.getModuleId(shell), showToast);
        }
        //#endregion
    });