requirejs.config({
    paths: {
        'text': '../Scripts/text',
        'durandal': '../Scripts/durandal',
        'plugins': '../Scripts/durandal/plugins',
        'transitions': '../Scripts/durandal/transitions'
    }
});

define('jquery', function () { return jQuery; });
define('knockout', ko);

define(['durandal/system', 'durandal/app', 'durandal/viewLocator', 'services/logger'],
    function (system, app, viewLocator, logger) {

    // Enable debug message to show in the console 
    //>>excludeStart("build", true);
    system.debug(true);
    //>>excludeEnd("build");

    app.configurePlugins({
        router: true,
        dialog: true,
        widget: true
    });

    app.start().then(function () {
        toastr.options.positionClass = 'toast-bottom-right';
        toastr.options.backgroundpositionClass = 'toast-bottom-right';

        //router.handleInvalidRoute = function (route, params) {
        //    logger.logError('No Route Found', route, 'main', true);
        //};

        // When finding a viewmodel module, replace the viewmodel string 
        // with view to find it partner view.
        //router.useConvention();
        viewLocator.useConvention();
        
        // Adapt to touch devices
        //app.adaptToDevice();
        //Show the app by setting the root view model for our application.
        app.setRoot('viewmodels/shell', 'entrance');
    });
});