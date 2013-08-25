(function () {
/**
 * almond 0.2.0 Copyright (c) 2011, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/almond for details
 */
//Going sloppy to avoid 'use strict' string cost, but strict practices should
//be followed.
/*jslint sloppy: true */
/*global setTimeout: false */

var requirejs, require, define;
(function (undef) {
    var main, req, makeMap, handlers,
        defined = {},
        waiting = {},
        config = {},
        defining = {},
        aps = [].slice;

    /**
     * Given a relative module name, like ./something, normalize it to
     * a real name that can be mapped to a path.
     * @param {String} name the relative name
     * @param {String} baseName a real name that the name arg is relative
     * to.
     * @returns {String} normalized name
     */
    function normalize(name, baseName) {
        var nameParts, nameSegment, mapValue, foundMap,
            foundI, foundStarMap, starI, i, j, part,
            baseParts = baseName && baseName.split("/"),
            map = config.map,
            starMap = (map && map['*']) || {};

        //Adjust any relative paths.
        if (name && name.charAt(0) === ".") {
            //If have a base name, try to normalize against it,
            //otherwise, assume it is a top-level require that will
            //be relative to baseUrl in the end.
            if (baseName) {
                //Convert baseName to array, and lop off the last part,
                //so that . matches that "directory" and not name of the baseName's
                //module. For instance, baseName of "one/two/three", maps to
                //"one/two/three.js", but we want the directory, "one/two" for
                //this normalization.
                baseParts = baseParts.slice(0, baseParts.length - 1);

                name = baseParts.concat(name.split("/"));

                //start trimDots
                for (i = 0; i < name.length; i += 1) {
                    part = name[i];
                    if (part === ".") {
                        name.splice(i, 1);
                        i -= 1;
                    } else if (part === "..") {
                        if (i === 1 && (name[2] === '..' || name[0] === '..')) {
                            //End of the line. Keep at least one non-dot
                            //path segment at the front so it can be mapped
                            //correctly to disk. Otherwise, there is likely
                            //no path mapping for a path starting with '..'.
                            //This can still fail, but catches the most reasonable
                            //uses of ..
                            break;
                        } else if (i > 0) {
                            name.splice(i - 1, 2);
                            i -= 2;
                        }
                    }
                }
                //end trimDots

                name = name.join("/");
            }
        }

        //Apply map config if available.
        if ((baseParts || starMap) && map) {
            nameParts = name.split('/');

            for (i = nameParts.length; i > 0; i -= 1) {
                nameSegment = nameParts.slice(0, i).join("/");

                if (baseParts) {
                    //Find the longest baseName segment match in the config.
                    //So, do joins on the biggest to smallest lengths of baseParts.
                    for (j = baseParts.length; j > 0; j -= 1) {
                        mapValue = map[baseParts.slice(0, j).join('/')];

                        //baseName segment has  config, find if it has one for
                        //this name.
                        if (mapValue) {
                            mapValue = mapValue[nameSegment];
                            if (mapValue) {
                                //Match, update name to the new value.
                                foundMap = mapValue;
                                foundI = i;
                                break;
                            }
                        }
                    }
                }

                if (foundMap) {
                    break;
                }

                //Check for a star map match, but just hold on to it,
                //if there is a shorter segment match later in a matching
                //config, then favor over this star map.
                if (!foundStarMap && starMap && starMap[nameSegment]) {
                    foundStarMap = starMap[nameSegment];
                    starI = i;
                }
            }

            if (!foundMap && foundStarMap) {
                foundMap = foundStarMap;
                foundI = starI;
            }

            if (foundMap) {
                nameParts.splice(0, foundI, foundMap);
                name = nameParts.join('/');
            }
        }

        return name;
    }

    function makeRequire(relName, forceSync) {
        return function () {
            //A version of a require function that passes a moduleName
            //value for items that may need to
            //look up paths relative to the moduleName
            return req.apply(undef, aps.call(arguments, 0).concat([relName, forceSync]));
        };
    }

    function makeNormalize(relName) {
        return function (name) {
            return normalize(name, relName);
        };
    }

    function makeLoad(depName) {
        return function (value) {
            defined[depName] = value;
        };
    }

    function callDep(name) {
        if (waiting.hasOwnProperty(name)) {
            var args = waiting[name];
            delete waiting[name];
            defining[name] = true;
            main.apply(undef, args);
        }

        if (!defined.hasOwnProperty(name) && !defining.hasOwnProperty(name)) {
            throw new Error('No ' + name);
        }
        return defined[name];
    }

    //Turns a plugin!resource to [plugin, resource]
    //with the plugin being undefined if the name
    //did not have a plugin prefix.
    function splitPrefix(name) {
        var prefix,
            index = name ? name.indexOf('!') : -1;
        if (index > -1) {
            prefix = name.substring(0, index);
            name = name.substring(index + 1, name.length);
        }
        return [prefix, name];
    }

    function onResourceLoad(name, defined, deps){
        if(requirejs.onResourceLoad && name){
            requirejs.onResourceLoad({defined:defined}, {id:name}, deps);
        }
    }

    /**
     * Makes a name map, normalizing the name, and using a plugin
     * for normalization if necessary. Grabs a ref to plugin
     * too, as an optimization.
     */
    makeMap = function (name, relName) {
        var plugin,
            parts = splitPrefix(name),
            prefix = parts[0];

        name = parts[1];

        if (prefix) {
            prefix = normalize(prefix, relName);
            plugin = callDep(prefix);
        }

        //Normalize according
        if (prefix) {
            if (plugin && plugin.normalize) {
                name = plugin.normalize(name, makeNormalize(relName));
            } else {
                name = normalize(name, relName);
            }
        } else {
            name = normalize(name, relName);
            parts = splitPrefix(name);
            prefix = parts[0];
            name = parts[1];
            if (prefix) {
                plugin = callDep(prefix);
            }
        }

        //Using ridiculous property names for space reasons
        return {
            f: prefix ? prefix + '!' + name : name, //fullName
            n: name,
            pr: prefix,
            p: plugin
        };
    };

    function makeConfig(name) {
        return function () {
            return (config && config.config && config.config[name]) || {};
        };
    }

    handlers = {
        require: function (name) {
            return makeRequire(name);
        },
        exports: function (name) {
            var e = defined[name];
            if (typeof e !== 'undefined') {
                return e;
            } else {
                return (defined[name] = {});
            }
        },
        module: function (name) {
            return {
                id: name,
                uri: '',
                exports: defined[name],
                config: makeConfig(name)
            };
        }
    };

    main = function (name, deps, callback, relName) {
        var cjsModule, depName, ret, map, i,
            args = [],
            usingExports;

        //Use name if no relName
        relName = relName || name;

        //Call the callback to define the module, if necessary.
        if (typeof callback === 'function') {

            //Pull out the defined dependencies and pass the ordered
            //values to the callback.
            //Default to [require, exports, module] if no deps
            deps = !deps.length && callback.length ? ['require', 'exports', 'module'] : deps;
            for (i = 0; i < deps.length; i += 1) {
                map = makeMap(deps[i], relName);
                depName = map.f;

                //Fast path CommonJS standard dependencies.
                if (depName === "require") {
                    args[i] = handlers.require(name);
                } else if (depName === "exports") {
                    //CommonJS module spec 1.1
                    args[i] = handlers.exports(name);
                    usingExports = true;
                } else if (depName === "module") {
                    //CommonJS module spec 1.1
                    cjsModule = args[i] = handlers.module(name);
                } else if (defined.hasOwnProperty(depName) ||
                           waiting.hasOwnProperty(depName) ||
                           defining.hasOwnProperty(depName)) {
                    args[i] = callDep(depName);
                } else if (map.p) {
                    map.p.load(map.n, makeRequire(relName, true), makeLoad(depName), {});
                    args[i] = defined[depName];
                } else {
                    throw new Error(name + ' missing ' + depName);
                }
            }

            ret = callback.apply(defined[name], args);

            if (name) {
                //If setting exports via "module" is in play,
                //favor that over return value and exports. After that,
                //favor a non-undefined return value over exports use.
                if (cjsModule && cjsModule.exports !== undef &&
                        cjsModule.exports !== defined[name]) {
                    defined[name] = cjsModule.exports;
                } else if (ret !== undef || !usingExports) {
                    //Use the return value from the function.
                    defined[name] = ret;
                }
            }
        } else if (name) {
            //May just be an object definition for the module. Only
            //worry about defining if have a module name.
            defined[name] = callback;
        }

        onResourceLoad(name, defined, args);
    };

    requirejs = require = req = function (deps, callback, relName, forceSync, alt) {
        if (typeof deps === "string") {
            if (handlers[deps]) {
                //callback in this case is really relName
                return handlers[deps](callback);
            }
            //Just return the module wanted. In this scenario, the
            //deps arg is the module name, and second arg (if passed)
            //is just the relName.
            //Normalize module name, if it contains . or ..
            return callDep(makeMap(deps, callback).f);
        } else if (!deps.splice) {
            //deps is a config object, not an array.
            config = deps;
            if (callback.splice) {
                //callback is an array, which means it is a dependency list.
                //Adjust args if there are dependencies
                deps = callback;
                callback = relName;
                relName = null;
            } else {
                deps = undef;
            }
        }

        //Support require(['a'])
        callback = callback || function () {};

        //If relName is a function, it is an errback handler,
        //so remove it.
        if (typeof relName === 'function') {
            relName = forceSync;
            forceSync = alt;
        }

        //Simulate async callback;
        if (forceSync) {
            main(undef, deps, callback, relName);
        } else {
            setTimeout(function () {
                main(undef, deps, callback, relName);
            }, 15);
        }

        return req;
    };

    /**
     * Just drops the config on the floor, but returns req in case
     * the config return value is used.
     */
    req.config = function (cfg) {
        config = cfg;
        return req;
    };

    define = function (name, deps, callback) {

        //This module may not have dependencies
        if (!deps.splice) {
            //deps is not an array, so probably means
            //an object literal or factory function for
            //the value. Adjust args.
            callback = deps;
            deps = [];
        }

        waiting[name] = [name, deps, callback];
    };

    define.amd = {
        jQuery: true
    };
}());

define("../Scripts/almond-custom", function(){});

define('durandal/system',["require","jquery"],function(e,t){function n(e){var t="[object "+e+"]";r["is"+e]=function(e){return s.call(e)==t}}var r,i=!1,o=Object.keys,a=Object.prototype.hasOwnProperty,s=Object.prototype.toString,c=!1,u=Array.isArray,l=Array.prototype.slice;if(Function.prototype.bind&&("object"==typeof console||"function"==typeof console)&&"object"==typeof console.log)try{["log","info","warn","error","assert","dir","clear","profile","profileEnd"].forEach(function(e){console[e]=this.call(console[e],console)},Function.prototype.bind)}catch(d){c=!0}e.on&&e.on("moduleLoaded",function(e,t){r.setModuleId(e,t)}),"undefined"!=typeof requirejs&&(requirejs.onResourceLoad=function(e,t){r.setModuleId(e.defined[t.id],t.id)});var f=function(){},v=function(){try{if("undefined"!=typeof console&&"function"==typeof console.log)if(window.opera)for(var e=0;e<arguments.length;)console.log("Item "+(e+1)+": "+arguments[e]),e++;else 1==l.call(arguments).length&&"string"==typeof l.call(arguments)[0]?console.log(l.call(arguments).toString()):console.log.apply(console,l.call(arguments));else Function.prototype.bind&&!c||"undefined"==typeof console||"object"!=typeof console.log||Function.prototype.call.call(console.log,console,l.call(arguments))}catch(t){}},g=function(e){if(e instanceof Error)throw e;throw new Error(e)};r={version:"2.0.0",noop:f,getModuleId:function(e){return e?"function"==typeof e?e.prototype.__moduleId__:"string"==typeof e?null:e.__moduleId__:null},setModuleId:function(e,t){return e?"function"==typeof e?(e.prototype.__moduleId__=t,void 0):("string"!=typeof e&&(e.__moduleId__=t),void 0):void 0},resolveObject:function(e){return r.isFunction(e)?new e:e},debug:function(e){return 1==arguments.length&&(i=e,i?(this.log=v,this.error=g,this.log("Debug:Enabled")):(this.log("Debug:Disabled"),this.log=f,this.error=f)),i},log:f,error:f,assert:function(e,t){e||r.error(new Error(t||"Assert:Failed"))},defer:function(e){return t.Deferred(e)},guid:function(){return"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,function(e){var t=0|16*Math.random(),n="x"==e?t:8|3&t;return n.toString(16)})},acquire:function(){var t,n=arguments[0],i=!1;return r.isArray(n)?(t=n,i=!0):t=l.call(arguments,0),this.defer(function(n){e(t,function(){var e=arguments;setTimeout(function(){e.length>1||i?n.resolve(l.call(e,0)):n.resolve(e[0])},1)},function(e){n.reject(e)})}).promise()},extend:function(e){for(var t=l.call(arguments,1),n=0;n<t.length;n++){var r=t[n];if(r)for(var i in r)e[i]=r[i]}return e},wait:function(e){return r.defer(function(t){setTimeout(t.resolve,e)}).promise()}},r.keys=o||function(e){if(e!==Object(e))throw new TypeError("Invalid object");var t=[];for(var n in e)a.call(e,n)&&(t[t.length]=n);return t},r.isElement=function(e){return!(!e||1!==e.nodeType)},r.isArray=u||function(e){return"[object Array]"==s.call(e)},r.isObject=function(e){return e===Object(e)},r.isBoolean=function(e){return"boolean"==typeof e},r.isPromise=function(e){return e&&r.isFunction(e.then)};for(var p=["Arguments","Function","String","Number","Date","RegExp"],h=0;h<p.length;h++)n(p[h]);return r});
define('durandal/viewEngine',["durandal/system","jquery"],function(e,t){var n;return n=t.parseHTML?function(e){return t.parseHTML(e)}:function(e){return t(e).get()},{viewExtension:".html",viewPlugin:"text",isViewUrl:function(e){return-1!==e.indexOf(this.viewExtension,e.length-this.viewExtension.length)},convertViewUrlToViewId:function(e){return e.substring(0,e.length-this.viewExtension.length)},convertViewIdToRequirePath:function(e){return this.viewPlugin+"!"+e+this.viewExtension},parseMarkup:n,processMarkup:function(e){var t=this.parseMarkup(e);return this.ensureSingleElement(t)},ensureSingleElement:function(e){if(1==e.length)return e[0];for(var n=[],r=0;r<e.length;r++){var i=e[r];if(8!=i.nodeType){if(3==i.nodeType){var o=/\S/.test(i.nodeValue);if(!o)continue}n.push(i)}}return n.length>1?t(n).wrapAll('<div class="durandal-wrapper"></div>').parent().get(0):n[0]},createView:function(t){var n=this,r=this.convertViewIdToRequirePath(t);return e.defer(function(i){e.acquire(r).then(function(e){var r=n.processMarkup(e);r.setAttribute("data-view",t),i.resolve(r)}).fail(function(e){n.createFallbackView(t,r,e).then(function(e){e.setAttribute("data-view",t),i.resolve(e)})})}).promise()},createFallbackView:function(t,n){var r=this,i='View Not Found. Searched for "'+t+'" via path "'+n+'".';return e.defer(function(e){e.resolve(r.processMarkup('<div class="durandal-view-404">'+i+"</div>"))}).promise()}}});
define('durandal/viewLocator',["durandal/system","durandal/viewEngine"],function(e,t){function n(e,t){for(var n=0;n<e.length;n++){var r=e[n],i=r.getAttribute("data-view");if(i==t)return r}}function r(e){return(e+"").replace(/([\\\.\+\*\?\[\^\]\$\(\)\{\}\=\!\<\>\|\:])/g,"\\$1")}return{useConvention:function(e,t,n){e=e||"viewmodels",t=t||"views",n=n||t;var i=new RegExp(r(e),"gi");this.convertModuleIdToViewId=function(e){return e.replace(i,t)},this.translateViewIdToArea=function(e,t){return t&&"partial"!=t?n+"/"+t+"/"+e:n+"/"+e}},locateViewForObject:function(t,n,r){var i;if(t.getView&&(i=t.getView()))return this.locateView(i,n,r);if(t.viewUrl)return this.locateView(t.viewUrl,n,r);var o=e.getModuleId(t);return o?this.locateView(this.convertModuleIdToViewId(o),n,r):this.locateView(this.determineFallbackViewId(t),n,r)},convertModuleIdToViewId:function(e){return e},determineFallbackViewId:function(e){var t=/function (.{1,})\(/,n=t.exec(e.constructor.toString()),r=n&&n.length>1?n[1]:"";return"views/"+r},translateViewIdToArea:function(e){return e},locateView:function(r,i,o){if("string"==typeof r){var a;if(a=t.isViewUrl(r)?t.convertViewUrlToViewId(r):r,i&&(a=this.translateViewIdToArea(a,i)),o){var s=n(o,a);if(s)return e.defer(function(e){e.resolve(s)}).promise()}return t.createView(a)}return e.defer(function(e){e.resolve(r)}).promise()}}});
define('durandal/binder',["durandal/system","knockout"],function(e,t){function n(t){return void 0===t?{applyBindings:!0}:e.isBoolean(t)?{applyBindings:t}:(void 0===t.applyBindings&&(t.applyBindings=!0),t)}function r(r,u,l,d){if(!u||!l)return i.throwOnErrors?e.error(o):e.log(o,u,d),void 0;if(!u.getAttribute)return i.throwOnErrors?e.error(a):e.log(a,u,d),void 0;var f=u.getAttribute("data-view");try{var v;return r&&r.binding&&(v=r.binding(u)),v=n(v),i.binding(d,u,v),v.applyBindings?(e.log("Binding",f,d),t.applyBindings(l,u)):r&&t.utils.domData.set(u,c,{$data:r}),i.bindingComplete(d,u,v),r&&r.bindingComplete&&r.bindingComplete(u),t.utils.domData.set(u,s,v),v}catch(g){g.message=g.message+";\nView: "+f+";\nModuleId: "+e.getModuleId(d),i.throwOnErrors?e.error(g):e.log(g.message)}}var i,o="Insufficient Information to Bind",a="Unexpected View Type",s="durandal-binding-instruction",c="__ko_bindingContext__";return i={binding:e.noop,bindingComplete:e.noop,throwOnErrors:!1,getBindingInstruction:function(e){return t.utils.domData.get(e,s)},bindContext:function(e,t,n){return n&&e&&(e=e.createChildContext(n)),r(n,t,e,n||(e?e.$data:null))},bind:function(e,t){return r(e,t,e,e)}}});
define('durandal/activator',["durandal/system","knockout"],function(e,t){function n(e){return void 0==e&&(e={}),e.closeOnDeactivate||(e.closeOnDeactivate=u.defaults.closeOnDeactivate),e.beforeActivate||(e.beforeActivate=u.defaults.beforeActivate),e.afterDeactivate||(e.afterDeactivate=u.defaults.afterDeactivate),e.affirmations||(e.affirmations=u.defaults.affirmations),e.interpretResponse||(e.interpretResponse=u.defaults.interpretResponse),e.areSameItem||(e.areSameItem=u.defaults.areSameItem),e}function r(t,n,r){return e.isArray(r)?t[n].apply(t,r):t[n](r)}function i(t,n,r,i,a){if(t&&t.deactivate){e.log("Deactivating",t);var o;try{o=t.deactivate(n)}catch(s){return e.error(s),i.resolve(!1),void 0}o&&o.then?o.then(function(){r.afterDeactivate(t,n,a),i.resolve(!0)},function(t){e.log(t),i.resolve(!1)}):(r.afterDeactivate(t,n,a),i.resolve(!0))}else t&&r.afterDeactivate(t,n,a),i.resolve(!0)}function a(t,n,i,a){if(t)if(t.activate){e.log("Activating",t);var o;try{o=r(t,"activate",a)}catch(s){return e.error(s),i(!1),void 0}o&&o.then?o.then(function(){n(t),i(!0)},function(t){e.log(t),i(!1)}):(n(t),i(!0))}else n(t),i(!0);else i(!0)}function o(t,n,r){return r.lifecycleData=null,e.defer(function(i){if(t&&t.canDeactivate){var a;try{a=t.canDeactivate(n)}catch(o){return e.error(o),i.resolve(!1),void 0}a.then?a.then(function(e){r.lifecycleData=e,i.resolve(r.interpretResponse(e))},function(t){e.error(t),i.resolve(!1)}):(r.lifecycleData=a,i.resolve(r.interpretResponse(a)))}else i.resolve(!0)}).promise()}function s(t,n,i,a){return i.lifecycleData=null,e.defer(function(o){if(t==n())return o.resolve(!0),void 0;if(t&&t.canActivate){var s;try{s=r(t,"canActivate",a)}catch(c){return e.error(c),o.resolve(!1),void 0}s.then?s.then(function(e){i.lifecycleData=e,o.resolve(i.interpretResponse(e))},function(t){e.error(t),o.resolve(!1)}):(i.lifecycleData=s,o.resolve(i.interpretResponse(s)))}else o.resolve(!0)}).promise()}function c(r,c){var u,l=t.observable(null);c=n(c);var d=t.computed({read:function(){return l()},write:function(e){d.viaSetter=!0,d.activateItem(e)}});return d.__activator__=!0,d.settings=c,c.activator=d,d.isActivating=t.observable(!1),d.canDeactivateItem=function(e,t){return o(e,t,c)},d.deactivateItem=function(t,n){return e.defer(function(e){d.canDeactivateItem(t,n).then(function(r){r?i(t,n,c,e,l):(d.notifySubscribers(),e.resolve(!1))})}).promise()},d.canActivateItem=function(e,t){return s(e,l,c,t)},d.activateItem=function(t,n){var r=d.viaSetter;return d.viaSetter=!1,e.defer(function(o){if(d.isActivating())return o.resolve(!1),void 0;d.isActivating(!0);var s=l();return c.areSameItem(s,t,u,n)?(d.isActivating(!1),o.resolve(!0),void 0):(d.canDeactivateItem(s,c.closeOnDeactivate).then(function(f){f?d.canActivateItem(t,n).then(function(f){f?e.defer(function(e){i(s,c.closeOnDeactivate,c,e)}).promise().then(function(){t=c.beforeActivate(t,n),a(t,l,function(e){u=n,d.isActivating(!1),o.resolve(e)},n)}):(r&&d.notifySubscribers(),d.isActivating(!1),o.resolve(!1))}):(r&&d.notifySubscribers(),d.isActivating(!1),o.resolve(!1))}),void 0)}).promise()},d.canActivate=function(){var e;return r?(e=r,r=!1):e=d(),d.canActivateItem(e)},d.activate=function(){var e;return r?(e=r,r=!1):e=d(),d.activateItem(e)},d.canDeactivate=function(e){return d.canDeactivateItem(d(),e)},d.deactivate=function(e){return d.deactivateItem(d(),e)},d.includeIn=function(e){e.canActivate=function(){return d.canActivate()},e.activate=function(){return d.activate()},e.canDeactivate=function(e){return d.canDeactivate(e)},e.deactivate=function(e){return d.deactivate(e)}},c.includeIn?d.includeIn(c.includeIn):r&&d.activate(),d.forItems=function(t){c.closeOnDeactivate=!1,c.determineNextItemToActivate=function(e,t){var n=t-1;return-1==n&&e.length>1?e[1]:n>-1&&n<e.length-1?e[n]:null},c.beforeActivate=function(e){var n=d();if(e){var r=t.indexOf(e);-1==r?t.push(e):e=t()[r]}else e=c.determineNextItemToActivate(t,n?t.indexOf(n):0);return e},c.afterDeactivate=function(e,n){n&&t.remove(e)};var n=d.canDeactivate;d.canDeactivate=function(r){return r?e.defer(function(e){function n(){for(var t=0;t<a.length;t++)if(!a[t])return e.resolve(!1),void 0;e.resolve(!0)}for(var i=t(),a=[],o=0;o<i.length;o++)d.canDeactivateItem(i[o],r).then(function(e){a.push(e),a.length==i.length&&n()})}).promise():n()};var r=d.deactivate;return d.deactivate=function(n){return n?e.defer(function(e){function r(r){d.deactivateItem(r,n).then(function(){a++,t.remove(r),a==o&&e.resolve()})}for(var i=t(),a=0,o=i.length,s=0;o>s;s++)r(i[s])}).promise():r()},d},d}var u,l={closeOnDeactivate:!0,affirmations:["yes","ok","true"],interpretResponse:function(n){return e.isObject(n)&&(n=n.can||!1),e.isString(n)?-1!==t.utils.arrayIndexOf(this.affirmations,n.toLowerCase()):n},areSameItem:function(e,t){return e==t},beforeActivate:function(e){return e},afterDeactivate:function(e,t,n){t&&n&&n(null)}};return u={defaults:l,create:c,isActivator:function(e){return e&&e.__activator__}}});
define('durandal/composition',["durandal/system","durandal/viewLocator","durandal/binder","durandal/viewEngine","durandal/activator","jquery","knockout"],function(e,t,n,r,i,a,o){function s(e){for(var t=[],n={childElements:t,activeView:null},r=o.virtualElements.firstChild(e);r;)1==r.nodeType&&(t.push(r),r.getAttribute(m)&&(n.activeView=r)),r=o.virtualElements.nextSibling(r);return n.activeView||(n.activeView=t[0]),n}function c(){y--,0===y&&setTimeout(function(){for(var e=b.length;e--;)b[e]();b=[]},1)}function l(t,n,r){if(r)n();else if(t.activate&&t.model&&t.model.activate){var i;i=e.isArray(t.activationData)?t.model.activate.apply(t.model,t.activationData):t.model.activate(t.activationData),i&&i.then?i.then(n):i||void 0===i?n():c()}else n()}function u(){var t=this;t.activeView&&t.activeView.removeAttribute(m),t.child&&(t.model&&t.model.attached&&(t.composingNewView||t.alwaysTriggerAttach)&&t.model.attached(t.child,t.parent,t),t.attached&&t.attached(t.child,t.parent,t),t.child.setAttribute(m,!0),t.composingNewView&&t.model&&(t.model.compositionComplete&&p.current.complete(function(){t.model.compositionComplete(t.child,t.parent,t)}),t.model.detached&&o.utils.domNodeDisposal.addDisposeCallback(t.child,function(){t.model.detached(t.child,t.parent,t)})),t.compositionComplete&&p.current.complete(function(){t.compositionComplete(t.child,t.parent,t)})),c(),t.triggerAttach=e.noop}function d(t){if(e.isString(t.transition)){if(t.activeView){if(t.activeView==t.child)return!1;if(!t.child)return!0;if(t.skipTransitionOnSameViewId){var n=t.activeView.getAttribute("data-view"),r=t.child.getAttribute("data-view");return n!=r}}return!0}return!1}function f(e){for(var t=0,n=e.length,r=[];n>t;t++){var i=e[t].cloneNode(!0);r.push(i)}return r}function v(e){var t=f(e.parts),n=p.getParts(t),r=p.getParts(e.child);for(var i in n)a(r[i]).replaceWith(n[i])}function g(t){var n,r,i=o.virtualElements.childNodes(t);if(!e.isArray(i)){var a=[];for(n=0,r=i.length;r>n;n++)a[n]=i[n];i=a}for(n=1,r=i.length;r>n;n++)o.removeNode(i[n])}var p,h={},m="data-active-view",b=[],y=0,w="durandal-composition-data",x="data-part",I="["+x+"]",D=["model","view","transition","area","strategy","activationData"],A={complete:function(e){b.push(e)}};return p={convertTransitionToModuleId:function(e){return"transitions/"+e},defaultTransitionName:null,current:A,addBindingHandler:function(e,t,n){var r,i,a="composition-handler-"+e;t=t||o.bindingHandlers[e],n=n||function(){return void 0},i=o.bindingHandlers[e]={init:function(e,r,i,s,c){var l={trigger:o.observable(null)};return p.current.complete(function(){t.init&&t.init(e,r,i,s,c),t.update&&(o.utils.domData.set(e,a,t),l.trigger("trigger"))}),o.utils.domData.set(e,a,l),n(e,r,i,s,c)},update:function(e,t,n,r,i){var s=o.utils.domData.get(e,a);return s.update?s.update(e,t,n,r,i):(s.trigger(),void 0)}};for(r in t)"init"!==r&&"update"!==r&&(i[r]=t[r])},getParts:function(t){var n={};e.isArray(t)||(t=[t]);for(var r=0;r<t.length;r++){var i=t[r];if(i.getAttribute){var o=i.getAttribute(x);o&&(n[o]=i);for(var s=a(I,i).not(a("[data-bind] "+I,i)),c=0;c<s.length;c++){var l=s.get(c);n[l.getAttribute(x)]=l}}}return n},cloneNodes:f,finalize:function(t){if(t.transition=t.transition||this.defaultTransitionName,t.child||t.activeView)if(d(t)){var r=this.convertTransitionToModuleId(t.transition);e.acquire(r).then(function(e){t.transition=e,e(t).then(function(){if(t.cacheViews){if(t.activeView){var e=n.getBindingInstruction(t.activeView);void 0==e.cacheViews||e.cacheViews||o.removeNode(t.activeView)}}else t.child?g(t.parent):o.virtualElements.emptyNode(t.parent);t.triggerAttach()})}).fail(function(t){e.error("Failed to load transition ("+r+"). Details: "+t.message)})}else{if(t.child!=t.activeView){if(t.cacheViews&&t.activeView){var i=n.getBindingInstruction(t.activeView);void 0==i.cacheViews||i.cacheViews?a(t.activeView).hide():o.removeNode(t.activeView)}t.child?(t.cacheViews||g(t.parent),a(t.child).show()):t.cacheViews||o.virtualElements.emptyNode(t.parent)}t.triggerAttach()}else t.cacheViews||o.virtualElements.emptyNode(t.parent),t.triggerAttach()},bindAndShow:function(e,t,i){t.child=e,t.composingNewView=t.cacheViews?-1==o.utils.arrayIndexOf(t.viewElements,e):!0,l(t,function(){if(t.binding&&t.binding(t.child,t.parent,t),t.preserveContext&&t.bindingContext)t.composingNewView&&(t.parts&&v(t),a(e).hide(),o.virtualElements.prepend(t.parent,e),n.bindContext(t.bindingContext,e,t.model));else if(e){var i=t.model||h,s=o.dataFor(e);if(s!=i){if(!t.composingNewView)return a(e).remove(),r.createView(e.getAttribute("data-view")).then(function(e){p.bindAndShow(e,t,!0)}),void 0;t.parts&&v(t),a(e).hide(),o.virtualElements.prepend(t.parent,e),n.bind(i,e)}}p.finalize(t)},i)},defaultStrategy:function(e){return t.locateViewForObject(e.model,e.area,e.viewElements)},getSettings:function(t){var n,a=t(),s=o.utils.unwrapObservable(a)||{},c=i.isActivator(a);if(e.isString(s))return s=r.isViewUrl(s)?{view:s}:{model:s,activate:!0};if(n=e.getModuleId(s))return s={model:s,activate:!0};!c&&s.model&&(c=i.isActivator(s.model));for(var l in s)s[l]=-1!=o.utils.arrayIndexOf(D,l)?o.utils.unwrapObservable(s[l]):s[l];return c?s.activate=!1:void 0===s.activate&&(s.activate=!0),s},executeStrategy:function(e){e.strategy(e).then(function(t){p.bindAndShow(t,e)})},inject:function(n){return n.model?n.view?(t.locateView(n.view,n.area,n.viewElements).then(function(e){p.bindAndShow(e,n)}),void 0):(n.strategy||(n.strategy=this.defaultStrategy),e.isString(n.strategy)?e.acquire(n.strategy).then(function(e){n.strategy=e,p.executeStrategy(n)}).fail(function(t){e.error("Failed to load view strategy ("+n.strategy+"). Details: "+t.message)}):this.executeStrategy(n),void 0):(this.bindAndShow(null,n),void 0)},compose:function(n,r,i,a){y++,a||(r=p.getSettings(function(){return r},n));var o=s(n);r.activeView=o.activeView,r.parent=n,r.triggerAttach=u,r.bindingContext=i,r.cacheViews&&!r.viewElements&&(r.viewElements=o.childElements),r.model?e.isString(r.model)?e.acquire(r.model).then(function(t){r.model=e.resolveObject(t),p.inject(r)}).fail(function(t){e.error("Failed to load composed module ("+r.model+"). Details: "+t.message)}):p.inject(r):r.view?(r.area=r.area||"partial",r.preserveContext=!0,t.locateView(r.view,r.area,r.viewElements).then(function(e){p.bindAndShow(e,r)})):this.bindAndShow(null,r)}},o.bindingHandlers.compose={init:function(){return{controlsDescendantBindings:!0}},update:function(e,t,n,i,a){var s=p.getSettings(t,e);if(s.mode){var c=o.utils.domData.get(e,w);if(!c){var l=o.virtualElements.childNodes(e);c={},"inline"===s.mode?c.view=r.ensureSingleElement(l):"templated"===s.mode&&(c.parts=f(l)),o.virtualElements.emptyNode(e),o.utils.domData.set(e,w,c)}"inline"===s.mode?s.view=c.view.cloneNode(!0):"templated"===s.mode&&(s.parts=c.parts),s.preserveContext=!0}p.compose(e,s,a,!0)}},o.virtualElements.allowedBindings.compose=!0,p});
define('durandal/events',["durandal/system"],function(e){var t=/\s+/,n=function(){},r=function(e,t){this.owner=e,this.events=t};return r.prototype.then=function(e,t){return this.callback=e||this.callback,this.context=t||this.context,this.callback?(this.owner.on(this.events,this.callback,this.context),this):this},r.prototype.on=r.prototype.then,r.prototype.off=function(){return this.owner.off(this.events,this.callback,this.context),this},n.prototype.on=function(e,n,i){var a,o,s;if(n){for(a=this.callbacks||(this.callbacks={}),e=e.split(t);o=e.shift();)s=a[o]||(a[o]=[]),s.push(n,i);return this}return new r(this,e)},n.prototype.off=function(n,r,i){var a,o,s,c;if(!(o=this.callbacks))return this;if(!(n||r||i))return delete this.callbacks,this;for(n=n?n.split(t):e.keys(o);a=n.shift();)if((s=o[a])&&(r||i))for(c=s.length-2;c>=0;c-=2)r&&s[c]!==r||i&&s[c+1]!==i||s.splice(c,2);else delete o[a];return this},n.prototype.trigger=function(e){var n,r,i,a,o,s,c,l;if(!(r=this.callbacks))return this;for(l=[],e=e.split(t),a=1,o=arguments.length;o>a;a++)l[a-1]=arguments[a];for(;n=e.shift();){if((c=r.all)&&(c=c.slice()),(i=r[n])&&(i=i.slice()),i)for(a=0,o=i.length;o>a;a+=2)i[a].apply(i[a+1]||this,l);if(c)for(s=[n].concat(l),a=0,o=c.length;o>a;a+=2)c[a].apply(c[a+1]||this,s)}return this},n.prototype.proxy=function(e){var t=this;return function(n){t.trigger(e,n)}},n.includeIn=function(e){e.on=n.prototype.on,e.off=n.prototype.off,e.trigger=n.prototype.trigger,e.proxy=n.prototype.proxy},n});
define('durandal/app',["durandal/system","durandal/viewEngine","durandal/composition","durandal/events","jquery"],function(e,t,n,r,i){function a(){return e.defer(function(t){return 0==s.length?(t.resolve(),void 0):(e.acquire(s).then(function(n){for(var r=0;r<n.length;r++){var i=n[r];if(i.install){var a=c[r];e.isObject(a)||(a={}),i.install(a),e.log("Plugin:Installed "+s[r])}else e.log("Plugin:Loaded "+s[r])}t.resolve()}).fail(function(t){e.error("Failed to load plugin(s). Details: "+t.message)}),void 0)}).promise()}var o,s=[],c=[];return o={title:"Application",configurePlugins:function(t,n){var r=e.keys(t);n=n||"plugins/",-1===n.indexOf("/",n.length-1)&&(n+="/");for(var i=0;i<r.length;i++){var a=r[i];s.push(n+a),c.push(t[a])}},start:function(){return e.log("Application:Starting"),this.title&&(document.title=this.title),e.defer(function(t){i(function(){a().then(function(){t.resolve(),e.log("Application:Started")})})}).promise()},setRoot:function(r,i,a){var o,s={activate:!0,transition:i};o=!a||e.isString(a)?document.getElementById(a||"applicationHost"):a,e.isString(r)?t.isViewUrl(r)?s.view=r:s.model=r:s.model=r,n.compose(o,s)}},r.includeIn(o),o});
define('services/logger',["durandal/system"],function(e){function t(e,t,n,i){r(e,t,n,i,"info")}function n(e,t,n,i){r(e,t,n,i,"error")}function r(t,n,r,i,a){r=r?"["+r+"] ":"",n?e.log(r,t,n):e.log(r,t),i&&("error"===a?toastr.error(t):toastr.info(t))}var i={log:t,logError:n};return i});
define('utils/knockoutExtenders',[],function(){function e(){t(),n()}function t(){ko.bindingHandlers.dateString={init:function(e,t){e.onchange=function(){var n=t();n(moment(e.value).toDate())}},update:function(e,t){var n=t(),r=ko.utils.unwrapObservable(n);r&&(e.value=moment(r).format("L"))}}}function n(){var e=function(e){toks=e.toFixed(2).replace("-","").split(".");var t="$"+$.map(toks[0].split("").reverse(),function(e,t){return[0===t%3&&t>0?",":"",e]}).reverse().join("")+"."+toks[1];return 0>e?"("+t+")":t};ko.subscribable.fn.money=function(){var t=this,n=function(e){t(parseFloat(e.replace(/[^0-9.-]/g,"")))},r=ko.computed({read:function(){return t()},write:n});return r.formatted=ko.computed({read:function(){return e(t())},write:n}),r}}return{registerExtenders:e}});
requirejs.config({paths:{text:"../Scripts/text",durandal:"../Scripts/durandal",plugins:"../Scripts/durandal/plugins",transitions:"../Scripts/durandal/transitions"}}),define("jquery",[],function(){return jQuery}),define("knockout",ko),define('main',["durandal/system","durandal/app","durandal/viewLocator","services/logger","utils/knockoutExtenders"],function(e,t,n,r,i){e.debug(!0),i.registerExtenders(),e.defer=function(e){var t=Q.defer();e.call(t,t);var n=t.promise;return t.promise=function(){return n},t},t.configurePlugins({router:!0,dialog:!0,widget:!0}),t.start().then(function(){toastr.options.positionClass="toast-bottom-right",toastr.options.backgroundpositionClass="toast-bottom-right",n.useConvention(),t.setRoot("viewmodels/shell","entrance")})});
define('services/modelExtensions',[],function(){function e(e){var t=e.metadataStore,n=function(t){t.rowtotal=ko.computed(function(){return t.UnitPrice()*parseInt("0"+t.Quantity(),10)}).money(),t.isValid=ko.computed(function(){return t.entityAspect.validateProperty("ProductID")&&t.entityAspect.validateProperty("UnitPrice")&&t.entityAspect.validateProperty("Quantity")}),t.ProductID.subscribe(function(n){var r=e.getEntityByKey("Product",n,!0);r?t.UnitPrice(r.UnitPrice()):t.UnitPrice(0)})},r=function(e){e.grandtotal=ko.computed(function(){var t=0;return $.each(e.OrderDetails(),function(){t+=this.rowtotal()}),t}).money()};t.registerEntityTypeCtor("OrderDetail",null,n),t.registerEntityTypeCtor("Order",null,r)}return{registerModelExtensions:e}});
define('services/dataContext',["services/logger","services/modelExtensions","durandal/system"],function(e,t){function n(e){var t=e.message;return t.match(/validation error/i)?r(e):t}function r(e){try{return e.entitiesWithErrors.map(function(e){return e.entityAspect.getValidationErrors().map(function(e){return e.errorMessage}).join("; <br/>")}).join("; <br/>")}catch(t){}return"validation error"}function i(t,n){e.logError(t,n,"datacontext",!0)}breeze.EntityQuery;var a=new breeze.EntityManager("breeze/Breeze"),o=ko.observable(!1),s=function(){var e=new breeze.Validator("minQty",function(e){return e>0},{messageTemplate:"'%displayName%' must be greater than 0"}),t=a.metadataStore.getEntityType("OrderDetail");t.getProperty("Quantity").validators.push(e)};t.registerModelExtensions(a),a.fetchMetadata().then(s),a.hasChangesChanged.subscribe(function(e){o(e.hasChanges)});var c=function(e){var t=breeze.EntityQuery.from("Products").orderBy("ProductName");return a.executeQuery(t).then(function(t){e(t.results)})},l=function(){var e=breeze.EntityQuery.from("Orders").select("OrderID, OrderDate, Customer.CompanyName").orderBy("OrderID desc").take(100);return a.executeQuery(e)},u=function(e,t){var n=breeze.EntityQuery.from("Orders").where("OrderID","==",e).expand("OrderDetails, OrderDetails.Product, Customer");return a.executeQuery(n).then(function(e){t(e.results[0])})},d=function(e){return a.createEntity("OrderDetail",{OrderID:e,Quantity:1})},f=function(){a.rejectChanges(),e.log("Canceled changes",null,!0)},v=function(){function t(t){e.log("Saved data successfully",t,!0)}function r(e){var t="Save failed: "+n(e);throw i(t,e),e.message=t,e}return a.saveChanges().then(t).fail(r)},g=function(e){return $.each(e.OrderDetails(),function(e,t){t&&t.entityAspect.setDeleted()}),e.entityAspect.setDeleted(),v()};return{hasChanges:o,getOrders:l,getOrderById:u,getProductLookup:c,addOrderLine:d,saveChanges:v,cancelChanges:f,deleteOrder:g}});
define('viewmodels/details',["services/logger"],function(e){function t(){return e.log("Details View Activated",null,"details",!0),!0}var n={activate:t,title:"Details View"};return n});
define('viewmodels/home',["services/logger"],function(e){function t(){return e.log("Home View Activated",null,"home",!0),!0}var n={activate:t,title:"Home View"};return n});
define('plugins/history',["durandal/system","jquery"],function(e,t){function n(e,t,n){if(n){var r=e.href.replace(/(javascript:|#).*$/,"");e.replace(r+"#"+t)}else e.hash="#"+t}var r=/^[#\/]|\s+$/g,i=/^\/+|\/+$/g,a=/msie [\w.]+/,o=/\/$/,s={interval:50,active:!1};return"undefined"!=typeof window&&(s.location=window.location,s.history=window.history),s.getHash=function(e){var t=(e||s).location.href.match(/#(.*)$/);return t?t[1]:""},s.getFragment=function(e,t){if(null==e)if(s._hasPushState||!s._wantsHashChange||t){e=s.location.pathname;var n=s.root.replace(o,"");e.indexOf(n)||(e=e.substr(n.length))}else e=s.getHash();return e.replace(r,"")},s.activate=function(n){s.active&&e.error("History has already been activated."),s.active=!0,s.options=e.extend({},{root:"/"},s.options,n),s.root=s.options.root,s._wantsHashChange=s.options.hashChange!==!1,s._wantsPushState=!!s.options.pushState,s._hasPushState=!!(s.options.pushState&&s.history&&s.history.pushState);var o=s.getFragment(),c=document.documentMode,l=a.exec(navigator.userAgent.toLowerCase())&&(!c||7>=c);s.root=("/"+s.root+"/").replace(i,"/"),l&&s._wantsHashChange&&(s.iframe=t('<iframe src="javascript:0" tabindex="-1" />').hide().appendTo("body")[0].contentWindow,s.navigate(o,!1)),s._hasPushState?t(window).on("popstate",s.checkUrl):s._wantsHashChange&&"onhashchange"in window&&!l?t(window).on("hashchange",s.checkUrl):s._wantsHashChange&&(s._checkUrlInterval=setInterval(s.checkUrl,s.interval)),s.fragment=o;var u=s.location,d=u.pathname.replace(/[^\/]$/,"$&/")===s.root;if(s._wantsHashChange&&s._wantsPushState){if(!s._hasPushState&&!d)return s.fragment=s.getFragment(null,!0),s.location.replace(s.root+s.location.search+"#"+s.fragment),!0;s._hasPushState&&d&&u.hash&&(this.fragment=s.getHash().replace(r,""),this.history.replaceState({},document.title,s.root+s.fragment+u.search))}return s.options.silent?void 0:s.loadUrl()},s.deactivate=function(){t(window).off("popstate",s.checkUrl).off("hashchange",s.checkUrl),clearInterval(s._checkUrlInterval),s.active=!1},s.checkUrl=function(){var e=s.getFragment();return e===s.fragment&&s.iframe&&(e=s.getFragment(s.getHash(s.iframe))),e===s.fragment?!1:(s.iframe&&s.navigate(e,!1),s.loadUrl(),void 0)},s.loadUrl=function(e){var t=s.fragment=s.getFragment(e);return s.options.routeHandler?s.options.routeHandler(t):!1},s.navigate=function(t,r){if(!s.active)return!1;if(void 0===r?r={trigger:!0}:e.isBoolean(r)&&(r={trigger:r}),t=s.getFragment(t||""),s.fragment!==t){s.fragment=t;var i=s.root+t;if(s._hasPushState)s.history[r.replace?"replaceState":"pushState"]({},document.title,i);else{if(!s._wantsHashChange)return s.location.assign(i);n(s.location,t,r.replace),s.iframe&&t!==s.getFragment(s.getHash(s.iframe))&&(r.replace||s.iframe.document.open().close(),n(s.iframe.location,t,r.replace))}return r.trigger?s.loadUrl(t):void 0}},s.navigateBack=function(){s.history.back()},s});
define('plugins/router',["durandal/system","durandal/app","durandal/activator","durandal/events","durandal/composition","plugins/history","knockout","jquery"],function(e,t,n,r,i,o,a,s){function c(e){return e=e.replace(b,"\\$&").replace(p,"(?:$1)?").replace(h,function(e,t){return t?e:"([^/]+)"}).replace(m,"(.*?)"),new RegExp("^"+e+"$")}function u(e){var t=e.indexOf(":"),n=t>0?t-1:e.length;return e.substring(0,n)}function l(e){return e.router&&e.router.loadUrl}function d(e,t){return-1!==e.indexOf(t,e.length-t.length)}function f(e,t){if(!e||!t)return!1;if(e.length!=t.length)return!1;for(var n=0,r=e.length;r>n;n++)if(e[n]!=t[n])return!1;return!0}var v,g,p=/\((.*?)\)/g,h=/(\(\?)?:\w+/g,m=/\*\w+/g,b=/[\-{}\[\]+?.,\\\^$|#\s]/g,y=/\/$/,w=function(){function i(t,n){e.log("Navigation Complete",t,n);var r=e.getModuleId(O);r&&N.trigger("router:navigation:from:"+r),O=t,C=n;var i=e.getModuleId(O);i&&N.trigger("router:navigation:to:"+i),l(t)||N.updateDocumentTitle(t,n),g.explicitNavigation=!1,g.navigatingBack=!1,N.trigger("router:navigation:complete",t,n,N)}function s(t,n){e.log("Navigation Cancelled"),N.activeInstruction(C),C&&N.navigate(C.fragment,!1),P(!1),g.explicitNavigation=!1,g.navigatingBack=!1,N.trigger("router:navigation:cancelled",t,n,N)}function p(t){e.log("Navigation Redirecting"),P(!1),g.explicitNavigation=!1,g.navigatingBack=!1,N.navigate(t,{trigger:!0,replace:!0})}function h(e,t,n){g.navigatingBack=!g.explicitNavigation&&O!=n.fragment,N.trigger("router:route:activating",t,n,N),e.activateItem(t,n.params).then(function(r){if(r){var o=O;i(t,n),l(t)&&k({router:t.router,fragment:n.fragment,queryString:n.queryString}),o==t&&N.attached()}else e.settings.lifecycleData&&e.settings.lifecycleData.redirect?p(e.settings.lifecycleData.redirect):s(t,n);v&&(v.resolve(),v=null)})}function m(t,n,r){var i=N.guardRoute(n,r);i?i.then?i.then(function(i){i?e.isString(i)?p(i):h(t,n,r):s(n,r)}):e.isString(i)?p(i):h(t,n,r):s(n,r)}function b(e,t,n){N.guardRoute?m(e,t,n):h(e,t,n)}function x(e){return C&&C.config.moduleId==e.config.moduleId&&O&&(O.canReuseForRoute&&O.canReuseForRoute.apply(O,e.params)||O.router&&O.router.loadUrl)}function I(){if(!P()){var t=V.shift();if(V=[],t){if(t.router){var r=t.fragment;return t.queryString&&(r+="?"+t.queryString),t.router.loadUrl(r),void 0}P(!0),N.activeInstruction(t),x(t)?b(n.create(),O,t):e.acquire(t.config.moduleId).then(function(n){var r=e.resolveObject(n);b(E,r,t)}).fail(function(n){e.error("Failed to load routed module ("+t.config.moduleId+"). Details: "+n.message)})}}}function k(e){V.unshift(e),I()}function S(e,t,n){for(var r=e.exec(t).slice(1),i=0;i<r.length;i++){var o=r[i];r[i]=o?decodeURIComponent(o):null}var a=N.parseQueryString(n);return a&&r.push(a),{params:r,queryParams:a}}function D(t){N.trigger("router:route:before-config",t,N),e.isRegExp(t)?t.routePattern=t.route:(t.title=t.title||N.convertRouteToTitle(t.route),t.moduleId=t.moduleId||N.convertRouteToModuleId(t.route),t.hash=t.hash||N.convertRouteToHash(t.route),t.routePattern=c(t.route)),N.trigger("router:route:after-config",t,N),N.routes.push(t),N.route(t.routePattern,function(e,n){var r=S(t.routePattern,e,n);k({fragment:e,queryString:n,config:t,params:r.params,queryParams:r.queryParams})})}function A(t){if(e.isArray(t.route))for(var n=0,r=t.route.length;r>n;n++){var i=e.extend({},t);i.route=t.route[n],n>0&&delete i.nav,D(i)}else D(t);return N}function _(e){e.isActive||(e.isActive=a.computed(function(){var t=E();return t&&t.__moduleId__==e.moduleId}))}var O,C,V=[],P=a.observable(!1),E=n.create(),N={handlers:[],routes:[],navigationModel:a.observableArray([]),activeItem:E,isNavigating:a.computed(function(){var e=E(),t=P(),n=e&&e.router&&e.router!=N&&e.router.isNavigating()?!0:!1;return t||n}),activeInstruction:a.observable(null),__router__:!0};return r.includeIn(N),E.settings.areSameItem=function(e,t,n,r){return e==t?f(n,r):!1},N.parseQueryString=function(e){var t,n;if(!e)return null;if(n=e.split("&"),0==n.length)return null;t={};for(var r=0;r<n.length;r++){var i=n[r];if(""!==i){var o=i.split("=");t[o[0]]=o[1]&&decodeURIComponent(o[1].replace(/\+/g," "))}}return t},N.route=function(e,t){N.handlers.push({routePattern:e,callback:t})},N.loadUrl=function(t){var n=N.handlers,r=null,i=t,a=t.indexOf("?");if(-1!=a&&(i=t.substring(0,a),r=t.substr(a+1)),N.relativeToParentRouter){var s=this.parent.activeInstruction();i=s.params.join("/"),i&&"/"==i[0]&&(i=i.substr(1)),i||(i=""),i=i.replace("//","/").replace("//","/")}i=i.replace(y,"");for(var c=0;c<n.length;c++){var u=n[c];if(u.routePattern.test(i))return u.callback(i,r),!0}return e.log("Route Not Found"),N.trigger("router:route:not-found",t,N),C&&o.navigate(C.fragment,{trigger:!1,replace:!0}),g.explicitNavigation=!1,g.navigatingBack=!1,!1},N.updateDocumentTitle=function(e,n){n.config.title?document.title=t.title?n.config.title+" | "+t.title:n.config.title:t.title&&(document.title=t.title)},N.navigate=function(e,t){return e&&-1!=e.indexOf("://")?(window.location.href=e,!0):(g.explicitNavigation=!0,o.navigate(e,t))},N.navigateBack=function(){o.navigateBack()},N.attached=function(){setTimeout(function(){P(!1),N.trigger("router:navigation:attached",O,C,N),I()},10)},N.compositionComplete=function(){N.trigger("router:navigation:composition-complete",O,C,N)},N.convertRouteToHash=function(e){if(N.relativeToParentRouter){var t=N.parent.activeInstruction(),n=t.config.hash+"/"+e;return o._hasPushState&&(n="/"+n),n=n.replace("//","/").replace("//","/")}return o._hasPushState?e:"#"+e},N.convertRouteToModuleId=function(e){return u(e)},N.convertRouteToTitle=function(e){var t=u(e);return t.substring(0,1).toUpperCase()+t.substring(1)},N.map=function(t,n){if(e.isArray(t)){for(var r=0;r<t.length;r++)N.map(t[r]);return N}return e.isString(t)||e.isRegExp(t)?(n?e.isString(n)&&(n={moduleId:n}):n={},n.route=t):n=t,A(n)},N.buildNavigationModel=function(t){var n=[],r=N.routes;t=t||100;for(var i=0;i<r.length;i++){var o=r[i];o.nav&&(e.isNumber(o.nav)||(o.nav=t),_(o),n.push(o))}return n.sort(function(e,t){return e.nav-t.nav}),N.navigationModel(n),N},N.mapUnknownRoutes=function(t,n){var r="*catchall",i=c(r);return N.route(i,function(a,s){var c=S(i,a,s),u={fragment:a,queryString:s,config:{route:r,routePattern:i},params:c.params,queryParams:c.queryParams};if(t)if(e.isString(t))u.config.moduleId=t,n&&o.navigate(n,{trigger:!1,replace:!0});else if(e.isFunction(t)){var l=t(u);if(l&&l.then)return l.then(function(){N.trigger("router:route:before-config",u.config,N),N.trigger("router:route:after-config",u.config,N),k(u)}),void 0}else u.config=t,u.config.route=r,u.config.routePattern=i;else u.config.moduleId=a;N.trigger("router:route:before-config",u.config,N),N.trigger("router:route:after-config",u.config,N),k(u)}),N},N.reset=function(){return C=O=void 0,N.handlers=[],N.routes=[],N.off(),delete N.options,N},N.makeRelative=function(t){return e.isString(t)&&(t={moduleId:t,route:t}),t.moduleId&&!d(t.moduleId,"/")&&(t.moduleId+="/"),t.route&&!d(t.route,"/")&&(t.route+="/"),t.fromParent&&(N.relativeToParentRouter=!0),N.on("router:route:before-config").then(function(e){t.moduleId&&(e.moduleId=t.moduleId+e.moduleId),t.route&&(e.route=""===e.route?t.route.substring(0,t.route.length-1):t.route+e.route)}),N},N.createChildRouter=function(){var e=w();return e.parent=N,e},N};return g=w(),g.explicitNavigation=!1,g.navigatingBack=!1,g.activate=function(t){return e.defer(function(n){if(v=n,g.options=e.extend({routeHandler:g.loadUrl},g.options,t),o.activate(g.options),o._hasPushState)for(var r=g.routes,i=r.length;i--;){var a=r[i];a.hash=a.hash.replace("#","")}s(document).delegate("a","click",function(e){if(g.explicitNavigation=!0,o._hasPushState&&!(e.altKey||e.ctrlKey||e.metaKey||e.shiftKey)){var t=s(this).attr("href"),n=this.protocol+"//";(!t||"#"!==t.charAt(0)&&t.slice(n.length)!==n)&&(e.preventDefault(),o.navigate(t))}})}).promise()},g.deactivate=function(){o.deactivate()},g.install=function(){a.bindingHandlers.router={init:function(){return{controlsDescendantBindings:!0}},update:function(e,t,n,r,o){var s=a.utils.unwrapObservable(t())||{};if(s.__router__)s={model:s.activeItem(),attached:s.attached,compositionComplete:s.compositionComplete,activate:!1};else{var c=a.utils.unwrapObservable(s.router||r.router)||g;s.model=c.activeItem(),s.attached=c.attached,s.compositionComplete=c.compositionComplete,s.activate=!1}i.compose(e,s,o)}},a.virtualElements.allowedBindings.router=!0},g});
define('plugins/dialog',["durandal/system","durandal/app","durandal/composition","durandal/activator","durandal/viewEngine","jquery","knockout"],function(e,t,n,r,i,o,a){function s(t){return e.defer(function(n){e.isString(t)?e.acquire(t).then(function(t){n.resolve(e.resolveObject(t))}).fail(function(n){e.error("Failed to load dialog module ("+t+"). Details: "+n.message)}):n.resolve(t)}).promise()}var c,l={},u=0,d=function(e,t,n){this.message=e,this.title=t||d.defaultTitle,this.options=n||d.defaultOptions};return d.prototype.selectOption=function(e){c.close(this,e)},d.prototype.getView=function(){return i.processMarkup(d.defaultViewMarkup)},d.setViewUrl=function(e){delete d.prototype.getView,d.prototype.viewUrl=e},d.defaultTitle=t.title||"Application",d.defaultOptions=["Ok"],d.defaultViewMarkup=['<div data-view="plugins/messageBox" class="messageBox">','<div class="modal-header">','<h3 data-bind="text: title"></h3>',"</div>",'<div class="modal-body">','<p class="message" data-bind="text: message"></p>',"</div>",'<div class="modal-footer" data-bind="foreach: options">','<button class="btn" data-bind="click: function () { $parent.selectOption($data); }, text: $data, css: { \'btn-primary\': $index() == 0, autofocus: $index() == 0 }"></button>',"</div>","</div>"].join("\n"),c={MessageBox:d,currentZIndex:1050,getNextZIndex:function(){return++this.currentZIndex},isOpen:function(){return u>0},getContext:function(e){return l[e||"default"]},addContext:function(e,t){t.name=e,l[e]=t;var n="show"+e.substr(0,1).toUpperCase()+e.substr(1);this[n]=function(t,n){return this.show(t,n,e)}},createCompositionSettings:function(e,t){var n={model:e,activate:!1};return t.attached&&(n.attached=t.attached),t.compositionComplete&&(n.compositionComplete=t.compositionComplete),n},getDialog:function(e){return e?e.__dialog__:void 0},close:function(e){var t=this.getDialog(e);if(t){var n=Array.prototype.slice.call(arguments,1);t.close.apply(t,n)}},show:function(t,i,o){var a=this,c=l[o||"default"];return e.defer(function(e){s(t).then(function(t){var o=r.create();o.activateItem(t,i).then(function(r){if(r){var i=t.__dialog__={owner:t,context:c,activator:o,close:function(){var n=arguments;o.deactivateItem(t,!0).then(function(r){r&&(u--,c.removeHost(i),delete t.__dialog__,0==n.length?e.resolve():1==n.length?e.resolve(n[0]):e.resolve.apply(e,n))})}};i.settings=a.createCompositionSettings(t,c),c.addHost(i),u++,n.compose(i.host,i.settings)}else e.resolve(!1)})})}).promise()},showMessage:function(t,n,r){return e.isString(this.MessageBox)?c.show(this.MessageBox,[t,n||d.defaultTitle,r||d.defaultOptions]):c.show(new this.MessageBox(t,n,r))},install:function(e){t.showDialog=function(e,t,n){return c.show(e,t,n)},t.showMessage=function(e,t,n){return c.showMessage(e,t,n)},e.messageBox&&(c.MessageBox=e.messageBox),e.messageBoxView&&(c.MessageBox.prototype.getView=function(){return e.messageBoxView})}},c.addContext("default",{blockoutOpacity:.2,removeDelay:200,addHost:function(e){var t=o("body"),n=o('<div class="modalBlockout"></div>').css({"z-index":c.getNextZIndex(),opacity:this.blockoutOpacity}).appendTo(t),r=o('<div class="modalHost"></div>').css({"z-index":c.getNextZIndex()}).appendTo(t);if(e.host=r.get(0),e.blockout=n.get(0),!c.isOpen()){e.oldBodyMarginRight=t.css("margin-right"),e.oldInlineMarginRight=t.get(0).style.marginRight;var i=o("html"),a=t.outerWidth(!0),s=i.scrollTop();o("html").css("overflow-y","hidden");var l=o("body").outerWidth(!0);t.css("margin-right",l-a+parseInt(e.oldBodyMarginRight)+"px"),i.scrollTop(s)}},removeHost:function(e){if(o(e.host).css("opacity",0),o(e.blockout).css("opacity",0),setTimeout(function(){a.removeNode(e.host),a.removeNode(e.blockout)},this.removeDelay),!c.isOpen()){var t=o("html"),n=t.scrollTop();t.css("overflow-y","").scrollTop(n),e.oldInlineMarginRight?o("body").css("margin-right",e.oldBodyMarginRight):o("body").css("margin-right","")}},compositionComplete:function(e,t,n){var r=o(e),i=r.width(),a=r.height(),s=c.getDialog(n.model);r.css({"margin-top":(-a/2).toString()+"px","margin-left":(-i/2).toString()+"px"}),o(s.host).css("opacity",1),o(e).hasClass("autoclose")&&o(s.blockout).click(function(){s.close()}),o(".autofocus",e).each(function(){o(this).focus()})}}),c});
define('viewmodels/order',["services/logger","plugins/router","services/dataContext","plugins/dialog","durandal/app"],function(e,t,n,r,i){var o=ko.observable(!1),a=ko.observable(!1),s=function(t){e.log("Order Detail View Activated",null,"orderDetail",!0);var r=n.getOrderById(parseInt(t,10),y.order),i=n.getProductLookup(y.productsLookup);return Q.all([i,r])},c=function(e){var t={customer:e,viewUrl:"views/billingaddress"};t.closeDialog=function(){r.close(this)},r.show(t)},l=function(e){var t={order:e,viewUrl:"views/shippingaddress"};t.closeDialog=function(){r.close(this)},r.show(t)},u=function(){n.addOrderLine(y.order().OrderID())},d=function(){t.navigateBack()},f=ko.computed(function(){return n.hasChanges()}),v=function(){n.cancelChanges()},g=ko.computed(function(){return f()&&!o()}),p=function(){function e(){o(!1)}return o(!0),n.saveChanges().fin(e)},h=function(){function r(r){function i(){t.navigate("#/orders")}function o(t){v();var n="Error: "+t.message;e.logError(n,t,system.getModuleId(y),!0)}"Yes"===r&&n.deleteOrder(y.order()).then(i).fail(o),a(!1)}var o='Delete Order "'+y.order().OrderID()+'" ?',s="Confirm Delete";return a(!0),i.showMessage(o,s,["Yes","No"]).then(r)},m=function(){function e(e){return"Yes"===e&&v(),e}if(a())return!1;if(f()){var t="Do you want to leave?",n="Navigate away and cancel your changes?";return i.showMessage(n,t,["Yes","No"]).then(e)}return!0},b=function(e){e.entityAspect.setDeleted()},y={activate:s,canDeactivate:m,title:"order",order:ko.observable(),productsLookup:ko.observableArray(),canSave:g,hasChanges:f,goBack:d,save:p,cancel:v,deleteOrder:h,addOrderLine:u,editBillAddress:c,editShipAddress:l,deleteOrderLine:b};return y});
define('viewmodels/orders',["services/logger","plugins/router","services/dataContext"],function(e,t,n){function r(e){var n="#/order/"+e.OrderID;return t.navigate(n),!1}function i(){return e.log("Orders View Activated",null,"orders",!0),n.getOrders().then(function(e){o.orders(e.results)})}var o={activate:i,title:"Orders",orders:ko.observableArray(),gotoOrder:r};return o});
define('viewmodels/shell',["durandal/system","plugins/router","services/logger"],function(e,t,n){function r(){return i()}function i(){return t.map([{route:"",title:"Home",moduleId:"viewmodels/home",nav:!0},{route:"details",moduleId:"viewmodels/details",nav:!0},{route:"orders",moduleId:"viewmodels/orders",nav:!0},{route:"order/:id",moduleId:"viewmodels/order",nav:!1}]).buildNavigationModel(),o("Hot Towel SPA Loaded!",null,!0),t.activate()}function o(t,r,i){n.log(t,r,e.getModuleId(a),i)}var a={activate:r,router:t};return a});
define('text',{load: function(id){throw new Error("Dynamic load not allowed: " + id);}});
define('text!views/billingaddress.html',[],function () { return '<div class="messageBox autoclose" style="max-width: 425px">\r\n\t<div class="modal-header text-center">\r\n\t\t<h3>Edit Billing Address</h3>\r\n\t</div>\r\n\r\n\t<div class="modal-body" data-bind="with: customer">\r\n\t\t<form class="form-horizontal " accept-charset="utf-8">\r\n\t\t\t<div class="control-group">\r\n\t\t\t\t<label class="control-label">\t\r\n\t\t\t\t\tBilling Name\r\n\t\t\t\t</label>\r\n\t\t\t\t<div class="controls">\r\n\t\t\t\t\t<input type="text" data-bind="value: CompanyName">\r\n\t\t\t\t</div>\r\n\t\t\t</div>\r\n \r\n\t\t\t<div class="control-group">\r\n\t\t\t\t<label class="control-label">\t\r\n\t\t\t\t\tStreet Address\r\n\t\t\t\t</label>\r\n\t\t\t\t<div class="controls">\r\n\t\t\t\t\t<input placeholder="Street Name and/or apartment number" type="text" data-bind="value: Address">\r\n\t\t\t\t</div>\r\n\t\t\t</div>\r\n\r\n\t\t\t<div class="control-group">\r\n\t\t\t\t<label class="control-label">\t\r\n\t\t\t\t\tCity\r\n\t\t\t\t</label>\r\n\t\t\t\t<div class="controls">\r\n\t\t\t\t\t<input placeholder="" type="text" data-bind="value: City">\r\n\t\t\t\t</div>\r\n\t\t\t</div>\r\n \r\n\t\t\t<div class="control-group">\r\n\t\t\t\t<label class="control-label">\t\r\n\t\t\t\t\tZip Code\r\n\t\t\t\t</label>\r\n\t\t\t\t<div class="controls"><input type="text" data-bind="value: PostalCode">\r\n\t\t\t\t</div>\r\n\t\t\t</div>\r\n \r\n\t\t\t<div class="control-group">\r\n\t\t\t\t<label class="control-label">\t\r\n\t\t\t\t\tState/Region\r\n\t\t\t\t</label>\r\n\t\t\t\t<div class="controls"><input type="text" data-bind="value: Region">\r\n\t\t\t\t</div>\r\n\t\t\t</div>\r\n\t\t\t\r\n\t\t\t<div class="control-group">\r\n\t\t\t\t<label for="country" class="control-label">\t\r\n\t\t\t\t\tCountry\r\n\t\t\t\t</label>\r\n\t\t\t\t<div class="controls">\r\n\t\t\t\t\t<input type="text" data-bind="value: Country" />\r\n\t\t\t\t</div>\r\n\t\t\t</div>\r\n\t\t</form>\r\n\t</div>\r\n\r\n\t<div class="modal-footer text-center">\r\n\t\t<div class="text-center">\r\n\t\t\t<button class="btn btn-primary" data-bind="click: closeDialog">Close</button>\r\n\t\t</div>\r\n\t</div>\r\n</div>';});

define('text!views/details.html',[],function () { return '<div class="container-fluid">\r\n    <h2 class="page-title" data-bind="text: title"></h2>\r\n</div>';});

define('text!views/home.html',[],function () { return '<div class="container-fluid">\r\n    <h2 class="page-title" data-bind="text: title"></h2>\r\n</div>\r\n';});

define('text!views/nav.html',[],function () { return '<nav class="container-fluid navbar navbar-static-top">\r\n    <div class="navbar-inner">\r\n        <ul class="nav" data-bind="foreach: router.navigationModel">\r\n            <li data-bind="css: { active: isActive }">\r\n                <a data-bind="attr: { href: hash }, text: title" href="#"></a>\r\n            </li>\r\n        </ul>\r\n        <div data-bind="css: { active: router.isNavigating }" \r\n            class="pull-right loader">\r\n            <i class="icon-spinner icon-2x icon-spin"></i>\r\n        </div>\r\n    </div>\r\n</nav>';});

define('text!views/order.html',[],function () { return '<div class="container-fluid">\r\n\r\n    <div class="row-fluid">\r\n        <div class="form-actions">\r\n            <button class="btn btn-inverse"\r\n                data-bind="click: goBack"><i class="icon-hand-left icon-white"></i> Back</button>\r\n            <button class="btn btn-inverse"\r\n                data-bind="click: cancel, enable: canSave"><i class="icon-undo icon-white"></i> Cancel</button>\r\n            <button class="btn btn-primary"\r\n                data-bind="click: save, enable: canSave"><i class="icon-save icon-white"></i> Save</button>\r\n        \r\n            <i class="icon-asterisk icon-red" data-bind="visible: hasChanges"></i>\r\n        \r\n            <button class="btn btn-danger pull-right"\r\n                data-bind="click: deleteOrder, disable: hasChanges"><i class="icon-trash icon-white"></i> Delete\r\n            </button>\r\n        </div>\r\n    </div>\r\n    <div class="row-fluid" data-bind="with: order">\r\n        <div class="span12 well">   \r\n            <fieldset class="span3" data-bind="with: Customer">\r\n                <legend class="muted">\r\n                    Billing Address \r\n                    <button class="btn btn-inverse btn-mini" data-bind="click: $root.editBillAddress">Edit</button>\r\n                </legend>\r\n                <strong data-bind="text: CompanyName"></strong><br />\r\n                <span data-bind="text: Address"></span><br />\r\n                <span data-bind="text: City"></span>, <span data-bind="text: Region"></span> <span data-bind="text: PostalCode"></span><br />\r\n                <span data-bind="text: Country"></span><br />\r\n            </fieldset>\r\n            <fieldset class="span3">\r\n                <legend class="muted">\r\n                    Shipping Address \r\n                    <button class="btn btn-inverse btn-mini" data-bind="click: $parent.editShipAddress">Edit</button>\r\n                </legend>\r\n                <strong data-bind="text:ShipName"></strong><br />\r\n                <span data-bind="text: ShipAddress"></span><br />\r\n                <span data-bind="text: ShipCity"></span>, <span data-bind="text: ShipRegion"></span> <span data-bind="text: ShipPostalCode"></span><br />\r\n                <span data-bind="text: ShipCountry"></span><br />\r\n            </fieldset>\r\n            <div class="span3 offset1">\r\n                <label><strong>Order Date</strong></label>\r\n                <input type="text" class="input-small" data-bind="datepicker: {}, dateString: OrderDate" />\r\n                <label><strong>Required Date</strong></label>\r\n                <input type="text" class="input-small" data-bind="datepicker: {}, dateString: RequiredDate" />\r\n            </div>\r\n            <h4 class="span2 muted text-right"><i>Order #</i><i data-bind="text: OrderID"></i></h4>\r\n        </div>\r\n    </div>\r\n    <div class="row-fluid">\r\n        <table class="table table-bordered table-edit table-striped">\r\n            <thead>\r\n                <tr class="info">\r\n                    <th>Product</th>\r\n                    <th>Price</th>\r\n                    <th>Quantity</th>\r\n                    <th>Total</th>\r\n                    <th></th>\r\n                </tr>\r\n            </thead>\r\n            <tbody data-bind="foreach: order().OrderDetails">\r\n                <tr data-bind="css: { error: !isValid() }">\r\n                    <td>\r\n                        <select class="input-xlarge" data-bind="options: $root.productsLookup, optionsText: \'ProductName\', optionsValue: \'ProductID\', value: ProductID, optionsCaption: \'Choose...\'"></select>\r\n                    </td>\r\n                    <td>\r\n                        <input type="text" class="input-mini text-right" data-bind="value: UnitPrice, valueUpdate: \'afterkeydown\'" />\r\n                    </td>\r\n                    <td>\r\n                        <input type="text" class="input-mini text-right" data-bind="value: Quantity, valueUpdate: \'afterkeydown\'" />\r\n                    </td>\r\n                    <td><div class="text-right" data-bind="text: rowtotal.formatted"></div></td>\r\n                    <td>\r\n                        <button class="btn btn-sm pull-right" data-bind="click: $root.deleteOrderLine"><i class="icon-remove icon-red icon-large"></i></button>\r\n                    </td>\r\n                </tr>\r\n            </tbody>\r\n            <tfoot>\r\n                <tr>\r\n                    <td colspan="3">\r\n                        <button class="btn btn-success pull-left" data-bind=\'click: addOrderLine\'><i class="icon-plus icon-white"></i> Add Line</button>\r\n                        <div class="text-right muted">\r\n                            <strong>Grand Total: </strong>\r\n                        </div>\r\n                    </td>\r\n                    <td>\r\n                        <div class="text-right">\r\n                            <strong data-bind="text: order().grandtotal.formatted"></strong>\r\n                        </div>\r\n                    </td>\r\n                    <td></td>\r\n                </tr>\r\n            </tfoot>\r\n        </table>\r\n        \r\n    </div>\r\n</div>';});

define('text!views/orders.html',[],function () { return '<div class="container-fluid">\r\n    <h2 class="page-title" data-bind="text: title"></h2>    \r\n\r\n    <table class="table table-hover table-striped table-bordered">\r\n        <thead>\r\n            <tr>\r\n                <th>Id</th>\r\n                <th>Date</th>\r\n                <th>Customer</th>\r\n            </tr>\r\n        </thead>\r\n        <tbody data-bind="foreach: orders">\r\n            <tr data-bind="click: $root.gotoOrder">\r\n                <td data-bind="text: OrderID"></td>\r\n                <td data-bind="text: moment(OrderDate).format(\'LL\')"></td>\r\n                <td data-bind="text: Customer_CompanyName"></td>\r\n            </tr>\r\n        </tbody>\r\n    </table>\r\n</div>';});

define('text!views/shell.html',[],function () { return '<div>\r\n    <header>\r\n        <!--ko compose: {view: \'nav\'} --><!--/ko-->\r\n    </header>\r\n     <section id="content">\r\n        <!--ko router: {\r\n            afterCompose: router.afterCompose, \r\n            transition: \'entrance\'} -->\r\n        <!--/ko-->\r\n    </section>\r\n</div>\r\n';});

define('text!views/shippingaddress.html',[],function () { return '<div class="messageBox autoclose" style="max-width: 425px">\r\n\t<div class="modal-header text-center">\r\n\t\t<h3>Edit Shipping Address</h3>\r\n\t</div>\r\n\r\n\t<div class="modal-body" data-bind="with: order">\r\n\t\t<form class="form-horizontal " accept-charset="utf-8">\r\n\t\t\t<div class="control-group">\r\n\t\t\t\t<label class="control-label">\t\r\n\t\t\t\t\tShipping Name\r\n\t\t\t\t</label>\r\n\t\t\t\t<div class="controls">\r\n\t\t\t\t\t<input type="text" data-bind="value: ShipName">\r\n\t\t\t\t</div>\r\n\t\t\t</div>\r\n \r\n\t\t\t<div class="control-group">\r\n\t\t\t\t<label class="control-label">\t\r\n\t\t\t\t\tStreet Address\r\n\t\t\t\t</label>\r\n\t\t\t\t<div class="controls">\r\n\t\t\t\t\t<input placeholder="Street Name and/or apartment number" type="text" data-bind="value: ShipAddress">\r\n\t\t\t\t</div>\r\n\t\t\t</div>\r\n\r\n\t\t\t<div class="control-group">\r\n\t\t\t\t<label class="control-label">\t\r\n\t\t\t\t\tCity\r\n\t\t\t\t</label>\r\n\t\t\t\t<div class="controls">\r\n\t\t\t\t\t<input placeholder="" type="text" data-bind="value: ShipCity">\r\n\t\t\t\t</div>\r\n\t\t\t</div>\r\n \r\n\t\t\t<div class="control-group">\r\n\t\t\t\t<label class="control-label">\t\r\n\t\t\t\t\tZip Code\r\n\t\t\t\t</label>\r\n\t\t\t\t<div class="controls"><input type="text" data-bind="value: ShipPostalCode">\r\n\t\t\t\t</div>\r\n\t\t\t</div>\r\n \r\n\t\t\t<div class="control-group">\r\n\t\t\t\t<label class="control-label">\t\r\n\t\t\t\t\tState/Region\r\n\t\t\t\t</label>\r\n\t\t\t\t<div class="controls"><input type="text" data-bind="value: ShipRegion">\r\n\t\t\t\t</div>\r\n\t\t\t</div>\r\n\t\t\t\r\n\t\t\t<div class="control-group">\r\n\t\t\t\t<label for="country" class="control-label">\t\r\n\t\t\t\t\tCountry\r\n\t\t\t\t</label>\r\n\t\t\t\t<div class="controls">\r\n\t\t\t\t\t<input type="text" data-bind="value: ShipCountry" />\r\n\t\t\t\t</div>\r\n\t\t\t</div>\r\n\t\t</form>\r\n\t</div>\r\n\r\n\t<div class="modal-footer text-center">\r\n\t\t<div class="text-center">\r\n\t\t\t<button class="btn btn-primary" data-bind="click: closeDialog">Close</button>\r\n\t\t</div>\r\n\t</div>\r\n</div>';});

define('plugins/http',["jquery","knockout"],function(e,t){return{callbackParam:"callback",get:function(t,n){return e.ajax(t,{data:n})},jsonp:function(t,n,r){return-1==t.indexOf("=?")&&(r=r||this.callbackParam,t+=-1==t.indexOf("?")?"?":"&",t+=r+"=?"),e.ajax({url:t,dataType:"jsonp",data:n})},post:function(n,r){return e.ajax({url:n,data:t.toJSON(r),type:"POST",contentType:"application/json",dataType:"json"})}}});
define('plugins/observable',["durandal/system","durandal/binder","knockout"],function(e,t,n){function r(e){var t=e[0];return"_"===t||"$"===t}function i(t){if(!t||e.isElement(t)||t.ko===n||t.jquery)return!1;var r=d.call(t);return-1==f.indexOf(r)&&!(t===!0||t===!1)}function a(e,t){var n=e.__observable__,r=!0;if(!n||!n.__full__){n=n||(e.__observable__={}),n.__full__=!0,v.forEach(function(n){e[n]=function(){r=!1;var e=m[n].apply(t,arguments);return r=!0,e}}),g.forEach(function(n){e[n]=function(){r&&t.valueWillMutate();var i=h[n].apply(e,arguments);return r&&t.valueHasMutated(),i}}),p.forEach(function(n){e[n]=function(){for(var i=0,a=arguments.length;a>i;i++)o(arguments[i]);r&&t.valueWillMutate();var s=h[n].apply(e,arguments);return r&&t.valueHasMutated(),s}}),e.splice=function(){for(var n=2,i=arguments.length;i>n;n++)o(arguments[n]);r&&t.valueWillMutate();var a=h.splice.apply(e,arguments);return r&&t.valueHasMutated(),a};for(var i=0,a=e.length;a>i;i++)o(e[i])}}function o(t){var o,s;if(i(t)&&(o=t.__observable__,!o||!o.__full__)){if(o=o||(t.__observable__={}),o.__full__=!0,e.isArray(t)){var l=n.observableArray(t);a(t,l)}else for(var u in t)r(u)||o[u]||(s=t[u],e.isFunction(s)||c(t,u,s));b&&e.log("Converted",t)}}function s(e,t,n){var r;e(t),r=e.peek(),n?r.destroyAll||(r||(r=[],e(r)),a(r,e)):o(r)}function c(t,r,i){var c,l,u=t.__observable__||(t.__observable__={});if(void 0===i&&(i=t[r]),e.isArray(i))c=n.observableArray(i),a(i,c),l=!0;else if("function"==typeof i){if(!n.isObservable(i))return null;c=i}else e.isPromise(i)?(c=n.observable(),i.then(function(t){if(e.isArray(t)){var r=n.observableArray(t);a(t,r),t=r}c(t)})):(c=n.observable(i),o(i));return Object.defineProperty(t,r,{configurable:!0,enumerable:!0,get:c,set:n.isWriteableObservable(c)?function(t){t&&e.isPromise(t)?t.then(function(t){s(c,t,e.isArray(t))}):s(c,t,l)}:void 0}),u[r]=c,c}function l(t,n,r){var i,a=this,o={owner:t,deferEvaluation:!0};return"function"==typeof r?o.read=r:("value"in r&&e.error('For ko.defineProperty, you must not specify a "value" for the property. You must provide a "get" function.'),"function"!=typeof r.get&&e.error('For ko.defineProperty, the third parameter must be either an evaluator function, or an options object containing a function called "get".'),o.read=r.get,o.write=r.set),i=a.computed(o),t[n]=i,c(t,n,i)}var u,d=Object.prototype.toString,f=["[object Function]","[object String]","[object Boolean]","[object Number]","[object Date]","[object RegExp]"],v=["remove","removeAll","destroy","destroyAll","replace"],g=["pop","reverse","sort","shift","splice"],p=["push","unshift"],h=Array.prototype,m=n.observableArray.fn,b=!1;return u=function(e,t){var r,i,a;return e?(r=e.__observable__,r&&(i=r[t])?i:(a=e[t],n.isObservable(a)?a:c(e,t,a))):null},u.defineProperty=l,u.convertProperty=c,u.convertObject=o,u.install=function(e){var n=t.binding;t.binding=function(e,t,r){r.applyBindings&&!r.skipConversion&&o(e),n(e,t)},b=e.logConversion},u});
define('plugins/serializer',["durandal/system"],function(e){return{typeAttribute:"type",space:void 0,replacer:function(e,t){if(e){var n=e[0];if("_"===n||"$"===n)return void 0}return t},serialize:function(t,n){return n=void 0===n?{}:n,(e.isString(n)||e.isNumber(n))&&(n={space:n}),JSON.stringify(t,n.replacer||this.replacer,n.space||this.space)},getTypeId:function(e){return e?e[this.typeAttribute]:void 0},typeMap:{},registerType:function(){var t=arguments[0];if(1==arguments.length){var n=t[this.typeAttribute]||e.getModuleId(t);this.typeMap[n]=t}else this.typeMap[t]=arguments[1]},reviver:function(e,t,n,r){var i=n(t);if(i){var o=r(i);if(o)return o.fromJSON?o.fromJSON(t):new o(t)}return t},deserialize:function(e,t){var n=this;t=t||{};var r=t.getTypeId||function(e){return n.getTypeId(e)},i=t.getConstructor||function(e){return n.typeMap[e]},o=t.reviver||function(e,t){return n.reviver(e,t,r,i)};return JSON.parse(e,o)}}});
define('plugins/widget',["durandal/system","durandal/composition","jquery","knockout"],function(e,t,n,r){function i(e,n){var i=r.utils.domData.get(e,c);i||(i={parts:t.cloneNodes(r.virtualElements.childNodes(e))},r.virtualElements.emptyNode(e),r.utils.domData.set(e,c,i)),n.parts=i.parts}var o={},a={},s=["model","view","kind"],c="durandal-widget-data",u={getSettings:function(t){var n=r.utils.unwrapObservable(t())||{};if(e.isString(n))return{kind:n};for(var i in n)n[i]=-1!=r.utils.arrayIndexOf(s,i)?r.utils.unwrapObservable(n[i]):n[i];return n},registerKind:function(e){r.bindingHandlers[e]={init:function(){return{controlsDescendantBindings:!0}},update:function(t,n,r,o,a){var s=u.getSettings(n);s.kind=e,i(t,s),u.create(t,s,a,!0)}},r.virtualElements.allowedBindings[e]=!0},mapKind:function(e,t,n){t&&(a[e]=t),n&&(o[e]=n)},mapKindToModuleId:function(e){return o[e]||u.convertKindToModulePath(e)},convertKindToModulePath:function(e){return"widgets/"+e+"/viewmodel"},mapKindToViewId:function(e){return a[e]||u.convertKindToViewPath(e)},convertKindToViewPath:function(e){return"widgets/"+e+"/view"},createCompositionSettings:function(e,t){return t.model||(t.model=this.mapKindToModuleId(t.kind)),t.view||(t.view=this.mapKindToViewId(t.kind)),t.preserveContext=!0,t.activate=!0,t.activationData=t,t.mode="templated",t},create:function(e,n,r,i){i||(n=u.getSettings(function(){return n},e));var o=u.createCompositionSettings(e,n);t.compose(e,o,r)},install:function(e){if(e.bindingName=e.bindingName||"widget",e.kinds)for(var t=e.kinds,n=0;n<t.length;n++)u.registerKind(t[n]);r.bindingHandlers[e.bindingName]={init:function(){return{controlsDescendantBindings:!0}},update:function(e,t,n,r,o){var a=u.getSettings(t);i(e,a),u.create(e,a,o,!0)}},r.virtualElements.allowedBindings[e.bindingName]=!0}};return u});
define('transitions/entrance',["durandal/system","durandal/composition","jquery"],function(e,t,n){var r=100,i={marginRight:0,marginLeft:0,opacity:1},o={marginLeft:"",marginRight:"",opacity:"",display:""},a=function(t){return e.defer(function(e){function a(){e.resolve()}function s(){t.keepScrollPosition||n(document).scrollTop(0)}function c(){s(),t.triggerAttach();var e={marginLeft:l?"0":"20px",marginRight:l?"0":"-20px",opacity:0,display:"block"},r=n(t.child);r.css(e),r.animate(i,u,"swing",function(){r.css(o),a()})}if(t.child){var u=t.duration||500,l=!!t.fadeOnly;t.activeView?n(t.activeView).fadeOut(r,c):c()}else n(t.activeView).fadeOut(r,a)}).promise()};return a});
require(["main"]);
}());