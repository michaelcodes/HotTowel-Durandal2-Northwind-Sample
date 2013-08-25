define(['durandal/system', 'plugins/router', 'services/logger'],
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
            router.map([
                { route: '', title: 'Home', moduleId: 'viewmodels/home', nav: true },
                { route: 'details', moduleId: 'viewmodels/details', nav: true },
                { route: 'orders', moduleId: 'viewmodels/orders', nav: true },
                { route: 'order/:id', moduleId: 'viewmodels/order', nav: false }
            ]).buildNavigationModel();

            log('Hot Towel SPA Loaded!', null, true);
            return router.activate();
        }

        function log(msg, data, showToast) {
            logger.log(msg, data, system.getModuleId(shell), showToast);
        }
        //#endregion
    });