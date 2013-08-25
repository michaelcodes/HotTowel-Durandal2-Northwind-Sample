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

define('durandal/system',["require","jquery"],function(e,t){function n(e){var t="[object "+e+"]";r["is"+e]=function(e){return u.call(e)==t}}var r,i=!1,o=Object.keys,a=Object.prototype.hasOwnProperty,u=Object.prototype.toString,c=!1,s=Array.isArray,l=Array.prototype.slice;if(Function.prototype.bind&&("object"==typeof console||"function"==typeof console)&&"object"==typeof console.log)try{["log","info","warn","error","assert","dir","clear","profile","profileEnd"].forEach(function(e){console[e]=this.call(console[e],console)},Function.prototype.bind)}catch(d){c=!0}e.on&&e.on("moduleLoaded",function(e,t){r.setModuleId(e,t)}),"undefined"!=typeof requirejs&&(requirejs.onResourceLoad=function(e,t){r.setModuleId(e.defined[t.id],t.id)});var f=function(){},v=function(){try{if("undefined"!=typeof console&&"function"==typeof console.log)if(window.opera)for(var e=0;e<arguments.length;)console.log("Item "+(e+1)+": "+arguments[e]),e++;else 1==l.call(arguments).length&&"string"==typeof l.call(arguments)[0]?console.log(l.call(arguments).toString()):console.log.apply(console,l.call(arguments));else Function.prototype.bind&&!c||"undefined"==typeof console||"object"!=typeof console.log||Function.prototype.call.call(console.log,console,l.call(arguments))}catch(t){}},g=function(e){if(e instanceof Error)throw e;throw new Error(e)};r={version:"2.0.0",noop:f,getModuleId:function(e){return e?"function"==typeof e?e.prototype.__moduleId__:"string"==typeof e?null:e.__moduleId__:null},setModuleId:function(e,t){return e?"function"==typeof e?(e.prototype.__moduleId__=t,void 0):("string"!=typeof e&&(e.__moduleId__=t),void 0):void 0},resolveObject:function(e){return r.isFunction(e)?new e:e},debug:function(e){return 1==arguments.length&&(i=e,i?(this.log=v,this.error=g,this.log("Debug:Enabled")):(this.log("Debug:Disabled"),this.log=f,this.error=f)),i},log:f,error:f,assert:function(e,t){e||r.error(new Error(t||"Assert:Failed"))},defer:function(e){return t.Deferred(e)},guid:function(){return"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,function(e){var t=0|16*Math.random(),n="x"==e?t:8|3&t;return n.toString(16)})},acquire:function(){var t,n=arguments[0],i=!1;return r.isArray(n)?(t=n,i=!0):t=l.call(arguments,0),this.defer(function(n){e(t,function(){var e=arguments;setTimeout(function(){e.length>1||i?n.resolve(l.call(e,0)):n.resolve(e[0])},1)},function(e){n.reject(e)})}).promise()},extend:function(e){for(var t=l.call(arguments,1),n=0;n<t.length;n++){var r=t[n];if(r)for(var i in r)e[i]=r[i]}return e},wait:function(e){return r.defer(function(t){setTimeout(t.resolve,e)}).promise()}},r.keys=o||function(e){if(e!==Object(e))throw new TypeError("Invalid object");var t=[];for(var n in e)a.call(e,n)&&(t[t.length]=n);return t},r.isElement=function(e){return!(!e||1!==e.nodeType)},r.isArray=s||function(e){return"[object Array]"==u.call(e)},r.isObject=function(e){return e===Object(e)},r.isBoolean=function(e){return"boolean"==typeof e},r.isPromise=function(e){return e&&r.isFunction(e.then)};for(var p=["Arguments","Function","String","Number","Date","RegExp"],m=0;m<p.length;m++)n(p[m]);return r});
define('durandal/viewEngine',["durandal/system","jquery"],function(e,t){var n;return n=t.parseHTML?function(e){return t.parseHTML(e)}:function(e){return t(e).get()},{viewExtension:".html",viewPlugin:"text",isViewUrl:function(e){return-1!==e.indexOf(this.viewExtension,e.length-this.viewExtension.length)},convertViewUrlToViewId:function(e){return e.substring(0,e.length-this.viewExtension.length)},convertViewIdToRequirePath:function(e){return this.viewPlugin+"!"+e+this.viewExtension},parseMarkup:n,processMarkup:function(e){var t=this.parseMarkup(e);return this.ensureSingleElement(t)},ensureSingleElement:function(e){if(1==e.length)return e[0];for(var n=[],r=0;r<e.length;r++){var i=e[r];if(8!=i.nodeType){if(3==i.nodeType){var o=/\S/.test(i.nodeValue);if(!o)continue}n.push(i)}}return n.length>1?t(n).wrapAll('<div class="durandal-wrapper"></div>').parent().get(0):n[0]},createView:function(t){var n=this,r=this.convertViewIdToRequirePath(t);return e.defer(function(i){e.acquire(r).then(function(e){var r=n.processMarkup(e);r.setAttribute("data-view",t),i.resolve(r)}).fail(function(e){n.createFallbackView(t,r,e).then(function(e){e.setAttribute("data-view",t),i.resolve(e)})})}).promise()},createFallbackView:function(t,n){var r=this,i='View Not Found. Searched for "'+t+'" via path "'+n+'".';return e.defer(function(e){e.resolve(r.processMarkup('<div class="durandal-view-404">'+i+"</div>"))}).promise()}}});
define('durandal/viewLocator',["durandal/system","durandal/viewEngine"],function(e,t){function n(e,t){for(var n=0;n<e.length;n++){var r=e[n],i=r.getAttribute("data-view");if(i==t)return r}}function r(e){return(e+"").replace(/([\\\.\+\*\?\[\^\]\$\(\)\{\}\=\!\<\>\|\:])/g,"\\$1")}return{useConvention:function(e,t,n){e=e||"viewmodels",t=t||"views",n=n||t;var i=new RegExp(r(e),"gi");this.convertModuleIdToViewId=function(e){return e.replace(i,t)},this.translateViewIdToArea=function(e,t){return t&&"partial"!=t?n+"/"+t+"/"+e:n+"/"+e}},locateViewForObject:function(t,n,r){var i;if(t.getView&&(i=t.getView()))return this.locateView(i,n,r);if(t.viewUrl)return this.locateView(t.viewUrl,n,r);var o=e.getModuleId(t);return o?this.locateView(this.convertModuleIdToViewId(o),n,r):this.locateView(this.determineFallbackViewId(t),n,r)},convertModuleIdToViewId:function(e){return e},determineFallbackViewId:function(e){var t=/function (.{1,})\(/,n=t.exec(e.constructor.toString()),r=n&&n.length>1?n[1]:"";return"views/"+r},translateViewIdToArea:function(e){return e},locateView:function(r,i,o){if("string"==typeof r){var a;if(a=t.isViewUrl(r)?t.convertViewUrlToViewId(r):r,i&&(a=this.translateViewIdToArea(a,i)),o){var u=n(o,a);if(u)return e.defer(function(e){e.resolve(u)}).promise()}return t.createView(a)}return e.defer(function(e){e.resolve(r)}).promise()}}});
define('durandal/binder',["durandal/system","knockout"],function(e,t){function n(t){return void 0===t?{applyBindings:!0}:e.isBoolean(t)?{applyBindings:t}:(void 0===t.applyBindings&&(t.applyBindings=!0),t)}function r(r,s,l,d){if(!s||!l)return i.throwOnErrors?e.error(o):e.log(o,s,d),void 0;if(!s.getAttribute)return i.throwOnErrors?e.error(a):e.log(a,s,d),void 0;var f=s.getAttribute("data-view");try{var v;return r&&r.binding&&(v=r.binding(s)),v=n(v),i.binding(d,s,v),v.applyBindings?(e.log("Binding",f,d),t.applyBindings(l,s)):r&&t.utils.domData.set(s,u,{$data:r}),i.bindingComplete(d,s,v),r&&r.bindingComplete&&r.bindingComplete(s),t.utils.domData.set(s,c,v),v}catch(g){g.message=g.message+";\nView: "+f+";\nModuleId: "+e.getModuleId(d),i.throwOnErrors?e.error(g):e.log(g.message)}}var i,o="Insufficient Information to Bind",a="Unexpected View Type",c="durandal-binding-instruction",u="__ko_bindingContext__";return i={binding:e.noop,bindingComplete:e.noop,throwOnErrors:!1,getBindingInstruction:function(e){return t.utils.domData.get(e,c)},bindContext:function(e,t,n){return n&&e&&(e=e.createChildContext(n)),r(n,t,e,n||(e?e.$data:null))},bind:function(e,t){return r(e,t,e,e)}}});
define('durandal/activator',["durandal/system","knockout"],function(e,t){function r(e){return void 0==e&&(e={}),e.closeOnDeactivate||(e.closeOnDeactivate=s.defaults.closeOnDeactivate),e.beforeActivate||(e.beforeActivate=s.defaults.beforeActivate),e.afterDeactivate||(e.afterDeactivate=s.defaults.afterDeactivate),e.affirmations||(e.affirmations=s.defaults.affirmations),e.interpretResponse||(e.interpretResponse=s.defaults.interpretResponse),e.areSameItem||(e.areSameItem=s.defaults.areSameItem),e}function n(t,r,n){return e.isArray(n)?t[r].apply(t,n):t[r](n)}function i(t,r,n,i,a){if(t&&t.deactivate){e.log("Deactivating",t);var o;try{o=t.deactivate(r)}catch(c){return e.error(c),i.resolve(!1),void 0}o&&o.then?o.then(function(){n.afterDeactivate(t,r,a),i.resolve(!0)},function(t){e.log(t),i.resolve(!1)}):(n.afterDeactivate(t,r,a),i.resolve(!0))}else t&&n.afterDeactivate(t,r,a),i.resolve(!0)}function a(t,r,i,a){if(t)if(t.activate){e.log("Activating",t);var o;try{o=n(t,"activate",a)}catch(c){return e.error(c),i(!1),void 0}o&&o.then?o.then(function(){r(t),i(!0)},function(t){e.log(t),i(!1)}):(r(t),i(!0))}else r(t),i(!0);else i(!0)}function o(t,r,n){return n.lifecycleData=null,e.defer(function(i){if(t&&t.canDeactivate){var a;try{a=t.canDeactivate(r)}catch(o){return e.error(o),i.resolve(!1),void 0}a.then?a.then(function(e){n.lifecycleData=e,i.resolve(n.interpretResponse(e))},function(t){e.error(t),i.resolve(!1)}):(n.lifecycleData=a,i.resolve(n.interpretResponse(a)))}else i.resolve(!0)}).promise()}function c(t,r,i,a){return i.lifecycleData=null,e.defer(function(o){if(t==r())return o.resolve(!0),void 0;if(t&&t.canActivate){var c;try{c=n(t,"canActivate",a)}catch(u){return e.error(u),o.resolve(!1),void 0}c.then?c.then(function(e){i.lifecycleData=e,o.resolve(i.interpretResponse(e))},function(t){e.error(t),o.resolve(!1)}):(i.lifecycleData=c,o.resolve(i.interpretResponse(c)))}else o.resolve(!0)}).promise()}function u(n,u){var s,l=t.observable(null);u=r(u);var d=t.computed({read:function(){return l()},write:function(e){d.viaSetter=!0,d.activateItem(e)}});return d.__activator__=!0,d.settings=u,u.activator=d,d.isActivating=t.observable(!1),d.canDeactivateItem=function(e,t){return o(e,t,u)},d.deactivateItem=function(t,r){return e.defer(function(e){d.canDeactivateItem(t,r).then(function(n){n?i(t,r,u,e,l):(d.notifySubscribers(),e.resolve(!1))})}).promise()},d.canActivateItem=function(e,t){return c(e,l,u,t)},d.activateItem=function(t,r){var n=d.viaSetter;return d.viaSetter=!1,e.defer(function(o){if(d.isActivating())return o.resolve(!1),void 0;d.isActivating(!0);var c=l();return u.areSameItem(c,t,s,r)?(d.isActivating(!1),o.resolve(!0),void 0):(d.canDeactivateItem(c,u.closeOnDeactivate).then(function(f){f?d.canActivateItem(t,r).then(function(f){f?e.defer(function(e){i(c,u.closeOnDeactivate,u,e)}).promise().then(function(){t=u.beforeActivate(t,r),a(t,l,function(e){s=r,d.isActivating(!1),o.resolve(e)},r)}):(n&&d.notifySubscribers(),d.isActivating(!1),o.resolve(!1))}):(n&&d.notifySubscribers(),d.isActivating(!1),o.resolve(!1))}),void 0)}).promise()},d.canActivate=function(){var e;return n?(e=n,n=!1):e=d(),d.canActivateItem(e)},d.activate=function(){var e;return n?(e=n,n=!1):e=d(),d.activateItem(e)},d.canDeactivate=function(e){return d.canDeactivateItem(d(),e)},d.deactivate=function(e){return d.deactivateItem(d(),e)},d.includeIn=function(e){e.canActivate=function(){return d.canActivate()},e.activate=function(){return d.activate()},e.canDeactivate=function(e){return d.canDeactivate(e)},e.deactivate=function(e){return d.deactivate(e)}},u.includeIn?d.includeIn(u.includeIn):n&&d.activate(),d.forItems=function(t){u.closeOnDeactivate=!1,u.determineNextItemToActivate=function(e,t){var r=t-1;return-1==r&&e.length>1?e[1]:r>-1&&r<e.length-1?e[r]:null},u.beforeActivate=function(e){var r=d();if(e){var n=t.indexOf(e);-1==n?t.push(e):e=t()[n]}else e=u.determineNextItemToActivate(t,r?t.indexOf(r):0);return e},u.afterDeactivate=function(e,r){r&&t.remove(e)};var r=d.canDeactivate;d.canDeactivate=function(n){return n?e.defer(function(e){function r(){for(var t=0;t<a.length;t++)if(!a[t])return e.resolve(!1),void 0;e.resolve(!0)}for(var i=t(),a=[],o=0;o<i.length;o++)d.canDeactivateItem(i[o],n).then(function(e){a.push(e),a.length==i.length&&r()})}).promise():r()};var n=d.deactivate;return d.deactivate=function(r){return r?e.defer(function(e){function n(n){d.deactivateItem(n,r).then(function(){a++,t.remove(n),a==o&&e.resolve()})}for(var i=t(),a=0,o=i.length,c=0;o>c;c++)n(i[c])}).promise():n()},d},d}var s,l={closeOnDeactivate:!0,affirmations:["yes","ok","true"],interpretResponse:function(r){return e.isObject(r)&&(r=r.can||!1),e.isString(r)?-1!==t.utils.arrayIndexOf(this.affirmations,r.toLowerCase()):r},areSameItem:function(e,t){return e==t},beforeActivate:function(e){return e},afterDeactivate:function(e,t,r){t&&r&&r(null)}};return s={defaults:l,create:u,isActivator:function(e){return e&&e.__activator__}}});
define('durandal/composition',["durandal/system","durandal/viewLocator","durandal/binder","durandal/viewEngine","durandal/activator","jquery","knockout"],function(e,t,n,i,r,a,o){function c(e){for(var t=[],n={childElements:t,activeView:null},i=o.virtualElements.firstChild(e);i;)1==i.nodeType&&(t.push(i),i.getAttribute(h)&&(n.activeView=i)),i=o.virtualElements.nextSibling(i);return n.activeView||(n.activeView=t[0]),n}function u(){y--,0===y&&setTimeout(function(){for(var e=w.length;e--;)w[e]();w=[]},1)}function s(t,n,i){if(i)n();else if(t.activate&&t.model&&t.model.activate){var r;r=e.isArray(t.activationData)?t.model.activate.apply(t.model,t.activationData):t.model.activate(t.activationData),r&&r.then?r.then(n):r||void 0===r?n():u()}else n()}function d(){var t=this;t.activeView&&t.activeView.removeAttribute(h),t.child&&(t.model&&t.model.attached&&(t.composingNewView||t.alwaysTriggerAttach)&&t.model.attached(t.child,t.parent,t),t.attached&&t.attached(t.child,t.parent,t),t.child.setAttribute(h,!0),t.composingNewView&&t.model&&(t.model.compositionComplete&&m.current.complete(function(){t.model.compositionComplete(t.child,t.parent,t)}),t.model.detached&&o.utils.domNodeDisposal.addDisposeCallback(t.child,function(){t.model.detached(t.child,t.parent,t)})),t.compositionComplete&&m.current.complete(function(){t.compositionComplete(t.child,t.parent,t)})),u(),t.triggerAttach=e.noop}function l(t){if(e.isString(t.transition)){if(t.activeView){if(t.activeView==t.child)return!1;if(!t.child)return!0;if(t.skipTransitionOnSameViewId){var n=t.activeView.getAttribute("data-view"),i=t.child.getAttribute("data-view");return n!=i}}return!0}return!1}function v(e){for(var t=0,n=e.length,i=[];n>t;t++){var r=e[t].cloneNode(!0);i.push(r)}return i}function f(e){var t=v(e.parts),n=m.getParts(t),i=m.getParts(e.child);for(var r in n)a(i[r]).replaceWith(n[r])}function g(t){var n,i,r=o.virtualElements.childNodes(t);if(!e.isArray(r)){var a=[];for(n=0,i=r.length;i>n;n++)a[n]=r[n];r=a}for(n=1,i=r.length;i>n;n++)o.removeNode(r[n])}var m,p={},h="data-active-view",w=[],y=0,b="durandal-composition-data",D="data-part",A="["+D+"]",I=["model","view","transition","area","strategy","activationData"],O={complete:function(e){w.push(e)}};return m={convertTransitionToModuleId:function(e){return"transitions/"+e},defaultTransitionName:null,current:O,addBindingHandler:function(e,t,n){var i,r,a="composition-handler-"+e;t=t||o.bindingHandlers[e],n=n||function(){return void 0},r=o.bindingHandlers[e]={init:function(e,i,r,c,u){var s={trigger:o.observable(null)};return m.current.complete(function(){t.init&&t.init(e,i,r,c,u),t.update&&(o.utils.domData.set(e,a,t),s.trigger("trigger"))}),o.utils.domData.set(e,a,s),n(e,i,r,c,u)},update:function(e,t,n,i,r){var c=o.utils.domData.get(e,a);return c.update?c.update(e,t,n,i,r):(c.trigger(),void 0)}};for(i in t)"init"!==i&&"update"!==i&&(r[i]=t[i])},getParts:function(t){var n={};e.isArray(t)||(t=[t]);for(var i=0;i<t.length;i++){var r=t[i];if(r.getAttribute){var o=r.getAttribute(D);o&&(n[o]=r);for(var c=a(A,r).not(a("[data-bind] "+A,r)),u=0;u<c.length;u++){var s=c.get(u);n[s.getAttribute(D)]=s}}}return n},cloneNodes:v,finalize:function(t){if(t.transition=t.transition||this.defaultTransitionName,t.child||t.activeView)if(l(t)){var i=this.convertTransitionToModuleId(t.transition);e.acquire(i).then(function(e){t.transition=e,e(t).then(function(){if(t.cacheViews){if(t.activeView){var e=n.getBindingInstruction(t.activeView);void 0==e.cacheViews||e.cacheViews||o.removeNode(t.activeView)}}else t.child?g(t.parent):o.virtualElements.emptyNode(t.parent);t.triggerAttach()})}).fail(function(t){e.error("Failed to load transition ("+i+"). Details: "+t.message)})}else{if(t.child!=t.activeView){if(t.cacheViews&&t.activeView){var r=n.getBindingInstruction(t.activeView);void 0==r.cacheViews||r.cacheViews?a(t.activeView).hide():o.removeNode(t.activeView)}t.child?(t.cacheViews||g(t.parent),a(t.child).show()):t.cacheViews||o.virtualElements.emptyNode(t.parent)}t.triggerAttach()}else t.cacheViews||o.virtualElements.emptyNode(t.parent),t.triggerAttach()},bindAndShow:function(e,t,r){t.child=e,t.composingNewView=t.cacheViews?-1==o.utils.arrayIndexOf(t.viewElements,e):!0,s(t,function(){if(t.binding&&t.binding(t.child,t.parent,t),t.preserveContext&&t.bindingContext)t.composingNewView&&(t.parts&&f(t),a(e).hide(),o.virtualElements.prepend(t.parent,e),n.bindContext(t.bindingContext,e,t.model));else if(e){var r=t.model||p,c=o.dataFor(e);if(c!=r){if(!t.composingNewView)return a(e).remove(),i.createView(e.getAttribute("data-view")).then(function(e){m.bindAndShow(e,t,!0)}),void 0;t.parts&&f(t),a(e).hide(),o.virtualElements.prepend(t.parent,e),n.bind(r,e)}}m.finalize(t)},r)},defaultStrategy:function(e){return t.locateViewForObject(e.model,e.area,e.viewElements)},getSettings:function(t){var n,a=t(),c=o.utils.unwrapObservable(a)||{},u=r.isActivator(a);if(e.isString(c))return c=i.isViewUrl(c)?{view:c}:{model:c,activate:!0};if(n=e.getModuleId(c))return c={model:c,activate:!0};!u&&c.model&&(u=r.isActivator(c.model));for(var s in c)c[s]=-1!=o.utils.arrayIndexOf(I,s)?o.utils.unwrapObservable(c[s]):c[s];return u?c.activate=!1:void 0===c.activate&&(c.activate=!0),c},executeStrategy:function(e){e.strategy(e).then(function(t){m.bindAndShow(t,e)})},inject:function(n){return n.model?n.view?(t.locateView(n.view,n.area,n.viewElements).then(function(e){m.bindAndShow(e,n)}),void 0):(n.strategy||(n.strategy=this.defaultStrategy),e.isString(n.strategy)?e.acquire(n.strategy).then(function(e){n.strategy=e,m.executeStrategy(n)}).fail(function(t){e.error("Failed to load view strategy ("+n.strategy+"). Details: "+t.message)}):this.executeStrategy(n),void 0):(this.bindAndShow(null,n),void 0)},compose:function(n,i,r,a){y++,a||(i=m.getSettings(function(){return i},n));var o=c(n);i.activeView=o.activeView,i.parent=n,i.triggerAttach=d,i.bindingContext=r,i.cacheViews&&!i.viewElements&&(i.viewElements=o.childElements),i.model?e.isString(i.model)?e.acquire(i.model).then(function(t){i.model=e.resolveObject(t),m.inject(i)}).fail(function(t){e.error("Failed to load composed module ("+i.model+"). Details: "+t.message)}):m.inject(i):i.view?(i.area=i.area||"partial",i.preserveContext=!0,t.locateView(i.view,i.area,i.viewElements).then(function(e){m.bindAndShow(e,i)})):this.bindAndShow(null,i)}},o.bindingHandlers.compose={init:function(){return{controlsDescendantBindings:!0}},update:function(e,t,n,r,a){var c=m.getSettings(t,e);if(c.mode){var u=o.utils.domData.get(e,b);if(!u){var s=o.virtualElements.childNodes(e);u={},"inline"===c.mode?u.view=i.ensureSingleElement(s):"templated"===c.mode&&(u.parts=v(s)),o.virtualElements.emptyNode(e),o.utils.domData.set(e,b,u)}"inline"===c.mode?c.view=u.view.cloneNode(!0):"templated"===c.mode&&(c.parts=u.parts),c.preserveContext=!0}m.compose(e,c,a,!0)}},o.virtualElements.allowedBindings.compose=!0,m});
define('durandal/events',["durandal/system"],function(e){var t=/\s+/,n=function(){},i=function(e,t){this.owner=e,this.events=t};return i.prototype.then=function(e,t){return this.callback=e||this.callback,this.context=t||this.context,this.callback?(this.owner.on(this.events,this.callback,this.context),this):this},i.prototype.on=i.prototype.then,i.prototype.off=function(){return this.owner.off(this.events,this.callback,this.context),this},n.prototype.on=function(e,n,r){var a,o,c;if(n){for(a=this.callbacks||(this.callbacks={}),e=e.split(t);o=e.shift();)c=a[o]||(a[o]=[]),c.push(n,r);return this}return new i(this,e)},n.prototype.off=function(n,i,r){var a,o,c,s;if(!(o=this.callbacks))return this;if(!(n||i||r))return delete this.callbacks,this;for(n=n?n.split(t):e.keys(o);a=n.shift();)if((c=o[a])&&(i||r))for(s=c.length-2;s>=0;s-=2)i&&c[s]!==i||r&&c[s+1]!==r||c.splice(s,2);else delete o[a];return this},n.prototype.trigger=function(e){var n,i,r,a,o,c,s,u;if(!(i=this.callbacks))return this;for(u=[],e=e.split(t),a=1,o=arguments.length;o>a;a++)u[a-1]=arguments[a];for(;n=e.shift();){if((s=i.all)&&(s=s.slice()),(r=i[n])&&(r=r.slice()),r)for(a=0,o=r.length;o>a;a+=2)r[a].apply(r[a+1]||this,u);if(s)for(c=[n].concat(u),a=0,o=s.length;o>a;a+=2)s[a].apply(s[a+1]||this,c)}return this},n.prototype.proxy=function(e){var t=this;return function(n){t.trigger(e,n)}},n.includeIn=function(e){e.on=n.prototype.on,e.off=n.prototype.off,e.trigger=n.prototype.trigger,e.proxy=n.prototype.proxy},n});
define('durandal/app',["durandal/system","durandal/viewEngine","durandal/composition","durandal/events","jquery"],function(e,t,r,n,i){function a(){return e.defer(function(t){return 0==c.length?(t.resolve(),void 0):(e.acquire(c).then(function(r){for(var n=0;n<r.length;n++){var i=r[n];if(i.install){var a=u[n];e.isObject(a)||(a={}),i.install(a),e.log("Plugin:Installed "+c[n])}else e.log("Plugin:Loaded "+c[n])}t.resolve()}).fail(function(t){e.error("Failed to load plugin(s). Details: "+t.message)}),void 0)}).promise()}var o,c=[],u=[];return o={title:"Application",configurePlugins:function(t,r){var n=e.keys(t);r=r||"plugins/",-1===r.indexOf("/",r.length-1)&&(r+="/");for(var i=0;i<n.length;i++){var a=n[i];c.push(r+a),u.push(t[a])}},start:function(){return e.log("Application:Starting"),this.title&&(document.title=this.title),e.defer(function(t){i(function(){a().then(function(){t.resolve(),e.log("Application:Started")})})}).promise()},setRoot:function(n,i,a){var o,c={activate:!0,transition:i};o=!a||e.isString(a)?document.getElementById(a||"applicationHost"):a,e.isString(n)?t.isViewUrl(n)?c.view=n:c.model=n:c.model=n,r.compose(o,c)}},n.includeIn(o),o});
define('services/logger',["durandal/system"],function(e){function t(e,t,r,o){n(e,t,r,o,"info")}function r(e,t,r,o){n(e,t,r,o,"error")}function n(t,r,n,o,a){n=n?"["+n+"] ":"",r?e.log(n,t,r):e.log(n,t),o&&("error"===a?toastr.error(t):toastr.info(t))}var o={log:t,logError:r};return o});
define('utils/knockoutExtenders',[],function(){function e(){t(),r()}function t(){ko.bindingHandlers.dateString={init:function(e,t){e.onchange=function(){var r=t();r(moment(e.value).toDate())}},update:function(e,t){var r=t(),n=ko.utils.unwrapObservable(r);n&&(e.value=moment(n).format("L"))}}}function r(){var e=function(e){toks=e.toFixed(2).replace("-","").split(".");var t="$"+$.map(toks[0].split("").reverse(),function(e,t){return[0===t%3&&t>0?",":"",e]}).reverse().join("")+"."+toks[1];return 0>e?"("+t+")":t};ko.subscribable.fn.money=function(){var t=this,r=function(e){t(parseFloat(e.replace(/[^0-9.-]/g,"")))},n=ko.computed({read:function(){return t()},write:r});return n.formatted=ko.computed({read:function(){return e(t())},write:r}),n}}return{registerExtenders:e}});
requirejs.config({paths:{text:"../Scripts/text",durandal:"../Scripts/durandal",plugins:"../Scripts/durandal/plugins",transitions:"../Scripts/durandal/transitions"}}),define("jquery",[],function(){return jQuery}),define("knockout",ko),define('main',["durandal/system","durandal/app","durandal/viewLocator","services/logger","utils/knockoutExtenders"],function(t,n,o,s,e){t.debug(!0),e.registerExtenders(),n.configurePlugins({router:!0,dialog:!0,widget:!0}),n.start().then(function(){toastr.options.positionClass="toast-bottom-right",toastr.options.backgroundpositionClass="toast-bottom-right",o.useConvention(),n.setRoot("viewmodels/shell","entrance")})});
define('services/modelExtensions',[],function(){function e(e){var t=e.metadataStore,r=function(t){t.rowtotal=ko.computed(function(){return t.UnitPrice()*parseInt("0"+t.Quantity(),10)}).money(),t.isValid=ko.computed(function(){return t.entityAspect.validateProperty("ProductID")&&t.entityAspect.validateProperty("UnitPrice")&&t.entityAspect.validateProperty("Quantity")}),t.ProductID.subscribe(function(r){var n=e.getEntityByKey("Product",r,!0);n?t.UnitPrice(n.UnitPrice()):t.UnitPrice(0)})},n=function(e){e.grandtotal=ko.computed(function(){var t=0;return $.each(e.OrderDetails(),function(){t+=this.rowtotal()}),t}).money()};t.registerEntityTypeCtor("OrderDetail",null,r),t.registerEntityTypeCtor("Order",null,n)}return{registerModelExtensions:e}});
define('services/dataContext',["services/logger","services/modelExtensions","durandal/system"],function(e,t){function r(e){var t=e.message;return t.match(/validation error/i)?n(e):t}function n(e){try{return e.entitiesWithErrors.map(function(e){return e.entityAspect.getValidationErrors().map(function(e){return e.errorMessage}).join("; <br/>")}).join("; <br/>")}catch(t){}return"validation error"}function a(t,r){e.logError(t,r,"datacontext",!0)}breeze.EntityQuery;var s=new breeze.EntityManager("breeze/Breeze"),o=ko.observable(!1),i=function(){var e=new breeze.Validator("minQty",function(e){return e>0},{messageTemplate:"'%displayName%' must be greater than 0"}),t=s.metadataStore.getEntityType("OrderDetail");t.getProperty("Quantity").validators.push(e)};t.registerModelExtensions(s),s.fetchMetadata().then(i),s.hasChangesChanged.subscribe(function(e){o(e.hasChanges)});var u=function(e){var t=breeze.EntityQuery.from("Products").orderBy("ProductName");return s.executeQuery(t).then(function(t){e(t.results)})},d=function(){var e=breeze.EntityQuery.from("Orders").select("OrderID, OrderDate, Customer.CompanyName").orderBy("OrderID desc").take(100);return s.executeQuery(e)},c=function(e,t){var r=breeze.EntityQuery.from("Orders").where("OrderID","==",e).expand("OrderDetails, OrderDetails.Product, Customer");return s.executeQuery(r).then(function(e){t(e.results[0])})},l=function(e){return s.createEntity("OrderDetail",{OrderID:e,Quantity:1})},g=function(){s.rejectChanges(),e.log("Canceled changes",null,!0)},f=function(){function t(t){e.log("Saved data successfully",t,!0)}function n(e){var t="Save failed: "+r(e);throw a(t,e),e.message=t,e}return s.saveChanges().then(t).fail(n)},y=function(e){return $.each(e.OrderDetails(),function(e,t){t&&t.entityAspect.setDeleted()}),e.entityAspect.setDeleted(),f()};return{hasChanges:o,getOrders:d,getOrderById:c,getProductLookup:u,addOrderLine:l,saveChanges:f,cancelChanges:g,deleteOrder:y}});
define('viewmodels/details',["services/logger"],function(e){function t(){return e.log("Details View Activated",null,"details",!0),!0}var r={activate:t,title:"Details View"};return r});
define('viewmodels/home',["services/logger"],function(e){function t(){return e.log("Home View Activated",null,"home",!0),!0}var r={activate:t,title:"Home View"};return r});
define('plugins/history',["durandal/system","jquery"],function(e,t){function n(e,t,n){if(n){var i=e.href.replace(/(javascript:|#).*$/,"");e.replace(i+"#"+t)}else e.hash="#"+t}var i=/^[#\/]|\s+$/g,r=/^\/+|\/+$/g,a=/msie [\w.]+/,o=/\/$/,s={interval:50,active:!1};return"undefined"!=typeof window&&(s.location=window.location,s.history=window.history),s.getHash=function(e){var t=(e||s).location.href.match(/#(.*)$/);return t?t[1]:""},s.getFragment=function(e,t){if(null==e)if(s._hasPushState||!s._wantsHashChange||t){e=s.location.pathname;var n=s.root.replace(o,"");e.indexOf(n)||(e=e.substr(n.length))}else e=s.getHash();return e.replace(i,"")},s.activate=function(n){s.active&&e.error("History has already been activated."),s.active=!0,s.options=e.extend({},{root:"/"},s.options,n),s.root=s.options.root,s._wantsHashChange=s.options.hashChange!==!1,s._wantsPushState=!!s.options.pushState,s._hasPushState=!!(s.options.pushState&&s.history&&s.history.pushState);var o=s.getFragment(),c=document.documentMode,l=a.exec(navigator.userAgent.toLowerCase())&&(!c||7>=c);s.root=("/"+s.root+"/").replace(r,"/"),l&&s._wantsHashChange&&(s.iframe=t('<iframe src="javascript:0" tabindex="-1" />').hide().appendTo("body")[0].contentWindow,s.navigate(o,!1)),s._hasPushState?t(window).on("popstate",s.checkUrl):s._wantsHashChange&&"onhashchange"in window&&!l?t(window).on("hashchange",s.checkUrl):s._wantsHashChange&&(s._checkUrlInterval=setInterval(s.checkUrl,s.interval)),s.fragment=o;var u=s.location,d=u.pathname.replace(/[^\/]$/,"$&/")===s.root;if(s._wantsHashChange&&s._wantsPushState){if(!s._hasPushState&&!d)return s.fragment=s.getFragment(null,!0),s.location.replace(s.root+s.location.search+"#"+s.fragment),!0;s._hasPushState&&d&&u.hash&&(this.fragment=s.getHash().replace(i,""),this.history.replaceState({},document.title,s.root+s.fragment+u.search))}return s.options.silent?void 0:s.loadUrl()},s.deactivate=function(){t(window).off("popstate",s.checkUrl).off("hashchange",s.checkUrl),clearInterval(s._checkUrlInterval),s.active=!1},s.checkUrl=function(){var e=s.getFragment();return e===s.fragment&&s.iframe&&(e=s.getFragment(s.getHash(s.iframe))),e===s.fragment?!1:(s.iframe&&s.navigate(e,!1),s.loadUrl(),void 0)},s.loadUrl=function(e){var t=s.fragment=s.getFragment(e);return s.options.routeHandler?s.options.routeHandler(t):!1},s.navigate=function(t,i){if(!s.active)return!1;if(void 0===i?i={trigger:!0}:e.isBoolean(i)&&(i={trigger:i}),t=s.getFragment(t||""),s.fragment!==t){s.fragment=t;var r=s.root+t;if(s._hasPushState)s.history[i.replace?"replaceState":"pushState"]({},document.title,r);else{if(!s._wantsHashChange)return s.location.assign(r);n(s.location,t,i.replace),s.iframe&&t!==s.getFragment(s.getHash(s.iframe))&&(i.replace||s.iframe.document.open().close(),n(s.iframe.location,t,i.replace))}return i.trigger?s.loadUrl(t):void 0}},s.navigateBack=function(){s.history.back()},s});
define('plugins/router',["durandal/system","durandal/app","durandal/activator","durandal/events","durandal/composition","plugins/history","knockout","jquery"],function(e,t,n,r,i,o,a,c){function u(e){return e=e.replace(y,"\\$&").replace(p,"(?:$1)?").replace(h,function(e,t){return t?e:"([^/]+)"}).replace(m,"(.*?)"),new RegExp("^"+e+"$")}function s(e){var t=e.indexOf(":"),n=t>0?t-1:e.length;return e.substring(0,n)}function l(e){return e.router&&e.router.loadUrl}function d(e,t){return-1!==e.indexOf(t,e.length-t.length)}function f(e,t){if(!e||!t)return!1;if(e.length!=t.length)return!1;for(var n=0,r=e.length;r>n;n++)if(e[n]!=t[n])return!1;return!0}var v,g,p=/\((.*?)\)/g,h=/(\(\?)?:\w+/g,m=/\*\w+/g,y=/[\-{}\[\]+?.,\\\^$|#\s]/g,b=/\/$/,w=function(){function i(t,n){e.log("Navigation Complete",t,n);var r=e.getModuleId(O);r&&B.trigger("router:navigation:from:"+r),O=t,C=n;var i=e.getModuleId(O);i&&B.trigger("router:navigation:to:"+i),l(t)||B.updateDocumentTitle(t,n),g.explicitNavigation=!1,g.navigatingBack=!1,B.trigger("router:navigation:complete",t,n,B)}function c(t,n){e.log("Navigation Cancelled"),B.activeInstruction(C),C&&B.navigate(C.fragment,!1),V(!1),g.explicitNavigation=!1,g.navigatingBack=!1,B.trigger("router:navigation:cancelled",t,n,B)}function p(t){e.log("Navigation Redirecting"),V(!1),g.explicitNavigation=!1,g.navigatingBack=!1,B.navigate(t,{trigger:!0,replace:!0})}function h(e,t,n){g.navigatingBack=!g.explicitNavigation&&O!=n.fragment,B.trigger("router:route:activating",t,n,B),e.activateItem(t,n.params).then(function(r){if(r){var o=O;i(t,n),l(t)&&k({router:t.router,fragment:n.fragment,queryString:n.queryString}),o==t&&B.attached()}else e.settings.lifecycleData&&e.settings.lifecycleData.redirect?p(e.settings.lifecycleData.redirect):c(t,n);v&&(v.resolve(),v=null)})}function m(t,n,r){var i=B.guardRoute(n,r);i?i.then?i.then(function(i){i?e.isString(i)?p(i):h(t,n,r):c(n,r)}):e.isString(i)?p(i):h(t,n,r):c(n,r)}function y(e,t,n){B.guardRoute?m(e,t,n):h(e,t,n)}function I(e){return C&&C.config.moduleId==e.config.moduleId&&O&&(O.canReuseForRoute&&O.canReuseForRoute.apply(O,e.params)||O.router&&O.router.loadUrl)}function x(){if(!V()){var t=P.shift();if(P=[],t){if(t.router){var r=t.fragment;return t.queryString&&(r+="?"+t.queryString),t.router.loadUrl(r),void 0}V(!0),B.activeInstruction(t),I(t)?y(n.create(),O,t):e.acquire(t.config.moduleId).then(function(n){var r=e.resolveObject(n);y(E,r,t)}).fail(function(n){e.error("Failed to load routed module ("+t.config.moduleId+"). Details: "+n.message)})}}}function k(e){P.unshift(e),x()}function _(e,t,n){for(var r=e.exec(t).slice(1),i=0;i<r.length;i++){var o=r[i];r[i]=o?decodeURIComponent(o):null}var a=B.parseQueryString(n);return a&&r.push(a),{params:r,queryParams:a}}function D(t){B.trigger("router:route:before-config",t,B),e.isRegExp(t)?t.routePattern=t.route:(t.title=t.title||B.convertRouteToTitle(t.route),t.moduleId=t.moduleId||B.convertRouteToModuleId(t.route),t.hash=t.hash||B.convertRouteToHash(t.route),t.routePattern=u(t.route)),B.trigger("router:route:after-config",t,B),B.routes.push(t),B.route(t.routePattern,function(e,n){var r=_(t.routePattern,e,n);k({fragment:e,queryString:n,config:t,params:r.params,queryParams:r.queryParams})})}function A(t){if(e.isArray(t.route))for(var n=0,r=t.route.length;r>n;n++){var i=e.extend({},t);i.route=t.route[n],n>0&&delete i.nav,D(i)}else D(t);return B}function S(e){e.isActive||(e.isActive=a.computed(function(){var t=E();return t&&t.__moduleId__==e.moduleId}))}var O,C,P=[],V=a.observable(!1),E=n.create(),B={handlers:[],routes:[],navigationModel:a.observableArray([]),activeItem:E,isNavigating:a.computed(function(){var e=E(),t=V(),n=e&&e.router&&e.router!=B&&e.router.isNavigating()?!0:!1;return t||n}),activeInstruction:a.observable(null),__router__:!0};return r.includeIn(B),E.settings.areSameItem=function(e,t,n,r){return e==t?f(n,r):!1},B.parseQueryString=function(e){var t,n;if(!e)return null;if(n=e.split("&"),0==n.length)return null;t={};for(var r=0;r<n.length;r++){var i=n[r];if(""!==i){var o=i.split("=");t[o[0]]=o[1]&&decodeURIComponent(o[1].replace(/\+/g," "))}}return t},B.route=function(e,t){B.handlers.push({routePattern:e,callback:t})},B.loadUrl=function(t){var n=B.handlers,r=null,i=t,a=t.indexOf("?");if(-1!=a&&(i=t.substring(0,a),r=t.substr(a+1)),B.relativeToParentRouter){var c=this.parent.activeInstruction();i=c.params.join("/"),i&&"/"==i[0]&&(i=i.substr(1)),i||(i=""),i=i.replace("//","/").replace("//","/")}i=i.replace(b,"");for(var u=0;u<n.length;u++){var s=n[u];if(s.routePattern.test(i))return s.callback(i,r),!0}return e.log("Route Not Found"),B.trigger("router:route:not-found",t,B),C&&o.navigate(C.fragment,{trigger:!1,replace:!0}),g.explicitNavigation=!1,g.navigatingBack=!1,!1},B.updateDocumentTitle=function(e,n){n.config.title?document.title=t.title?n.config.title+" | "+t.title:n.config.title:t.title&&(document.title=t.title)},B.navigate=function(e,t){return e&&-1!=e.indexOf("://")?(window.location.href=e,!0):(g.explicitNavigation=!0,o.navigate(e,t))},B.navigateBack=function(){o.navigateBack()},B.attached=function(){setTimeout(function(){V(!1),B.trigger("router:navigation:attached",O,C,B),x()},10)},B.compositionComplete=function(){B.trigger("router:navigation:composition-complete",O,C,B)},B.convertRouteToHash=function(e){if(B.relativeToParentRouter){var t=B.parent.activeInstruction(),n=t.config.hash+"/"+e;return o._hasPushState&&(n="/"+n),n=n.replace("//","/").replace("//","/")}return o._hasPushState?e:"#"+e},B.convertRouteToModuleId=function(e){return s(e)},B.convertRouteToTitle=function(e){var t=s(e);return t.substring(0,1).toUpperCase()+t.substring(1)},B.map=function(t,n){if(e.isArray(t)){for(var r=0;r<t.length;r++)B.map(t[r]);return B}return e.isString(t)||e.isRegExp(t)?(n?e.isString(n)&&(n={moduleId:n}):n={},n.route=t):n=t,A(n)},B.buildNavigationModel=function(t){var n=[],r=B.routes;t=t||100;for(var i=0;i<r.length;i++){var o=r[i];o.nav&&(e.isNumber(o.nav)||(o.nav=t),S(o),n.push(o))}return n.sort(function(e,t){return e.nav-t.nav}),B.navigationModel(n),B},B.mapUnknownRoutes=function(t,n){var r="*catchall",i=u(r);return B.route(i,function(a,c){var u=_(i,a,c),s={fragment:a,queryString:c,config:{route:r,routePattern:i},params:u.params,queryParams:u.queryParams};if(t)if(e.isString(t))s.config.moduleId=t,n&&o.navigate(n,{trigger:!1,replace:!0});else if(e.isFunction(t)){var l=t(s);if(l&&l.then)return l.then(function(){B.trigger("router:route:before-config",s.config,B),B.trigger("router:route:after-config",s.config,B),k(s)}),void 0}else s.config=t,s.config.route=r,s.config.routePattern=i;else s.config.moduleId=a;B.trigger("router:route:before-config",s.config,B),B.trigger("router:route:after-config",s.config,B),k(s)}),B},B.reset=function(){return C=O=void 0,B.handlers=[],B.routes=[],B.off(),delete B.options,B},B.makeRelative=function(t){return e.isString(t)&&(t={moduleId:t,route:t}),t.moduleId&&!d(t.moduleId,"/")&&(t.moduleId+="/"),t.route&&!d(t.route,"/")&&(t.route+="/"),t.fromParent&&(B.relativeToParentRouter=!0),B.on("router:route:before-config").then(function(e){t.moduleId&&(e.moduleId=t.moduleId+e.moduleId),t.route&&(e.route=""===e.route?t.route.substring(0,t.route.length-1):t.route+e.route)}),B},B.createChildRouter=function(){var e=w();return e.parent=B,e},B};return g=w(),g.explicitNavigation=!1,g.navigatingBack=!1,g.activate=function(t){return e.defer(function(n){if(v=n,g.options=e.extend({routeHandler:g.loadUrl},g.options,t),o.activate(g.options),o._hasPushState)for(var r=g.routes,i=r.length;i--;){var a=r[i];a.hash=a.hash.replace("#","")}c(document).delegate("a","click",function(e){if(g.explicitNavigation=!0,o._hasPushState&&!(e.altKey||e.ctrlKey||e.metaKey||e.shiftKey)){var t=c(this).attr("href"),n=this.protocol+"//";(!t||"#"!==t.charAt(0)&&t.slice(n.length)!==n)&&(e.preventDefault(),o.navigate(t))}})}).promise()},g.deactivate=function(){o.deactivate()},g.install=function(){a.bindingHandlers.router={init:function(){return{controlsDescendantBindings:!0}},update:function(e,t,n,r,o){var c=a.utils.unwrapObservable(t())||{};if(c.__router__)c={model:c.activeItem(),attached:c.attached,compositionComplete:c.compositionComplete,activate:!1};else{var u=a.utils.unwrapObservable(c.router||r.router)||g;c.model=u.activeItem(),c.attached=u.attached,c.compositionComplete=u.compositionComplete,c.activate=!1}i.compose(e,c,o)}},a.virtualElements.allowedBindings.router=!0},g});
define('plugins/dialog',["durandal/system","durandal/app","durandal/composition","durandal/activator","durandal/viewEngine","jquery","knockout"],function(e,t,n,i,r,o,a){function s(t){return e.defer(function(n){e.isString(t)?e.acquire(t).then(function(t){n.resolve(e.resolveObject(t))}).fail(function(n){e.error("Failed to load dialog module ("+t+"). Details: "+n.message)}):n.resolve(t)}).promise()}var c,u={},l=0,d=function(e,t,n){this.message=e,this.title=t||d.defaultTitle,this.options=n||d.defaultOptions};return d.prototype.selectOption=function(e){c.close(this,e)},d.prototype.getView=function(){return r.processMarkup(d.defaultViewMarkup)},d.setViewUrl=function(e){delete d.prototype.getView,d.prototype.viewUrl=e},d.defaultTitle=t.title||"Application",d.defaultOptions=["Ok"],d.defaultViewMarkup=['<div data-view="plugins/messageBox" class="messageBox">','<div class="modal-header">','<h3 data-bind="text: title"></h3>',"</div>",'<div class="modal-body">','<p class="message" data-bind="text: message"></p>',"</div>",'<div class="modal-footer" data-bind="foreach: options">','<button class="btn" data-bind="click: function () { $parent.selectOption($data); }, text: $data, css: { \'btn-primary\': $index() == 0, autofocus: $index() == 0 }"></button>',"</div>","</div>"].join("\n"),c={MessageBox:d,currentZIndex:1050,getNextZIndex:function(){return++this.currentZIndex},isOpen:function(){return l>0},getContext:function(e){return u[e||"default"]},addContext:function(e,t){t.name=e,u[e]=t;var n="show"+e.substr(0,1).toUpperCase()+e.substr(1);this[n]=function(t,n){return this.show(t,n,e)}},createCompositionSettings:function(e,t){var n={model:e,activate:!1};return t.attached&&(n.attached=t.attached),t.compositionComplete&&(n.compositionComplete=t.compositionComplete),n},getDialog:function(e){return e?e.__dialog__:void 0},close:function(e){var t=this.getDialog(e);if(t){var n=Array.prototype.slice.call(arguments,1);t.close.apply(t,n)}},show:function(t,r,o){var a=this,c=u[o||"default"];return e.defer(function(e){s(t).then(function(t){var o=i.create();o.activateItem(t,r).then(function(i){if(i){var r=t.__dialog__={owner:t,context:c,activator:o,close:function(){var n=arguments;o.deactivateItem(t,!0).then(function(i){i&&(l--,c.removeHost(r),delete t.__dialog__,0==n.length?e.resolve():1==n.length?e.resolve(n[0]):e.resolve.apply(e,n))})}};r.settings=a.createCompositionSettings(t,c),c.addHost(r),l++,n.compose(r.host,r.settings)}else e.resolve(!1)})})}).promise()},showMessage:function(t,n,i){return e.isString(this.MessageBox)?c.show(this.MessageBox,[t,n||d.defaultTitle,i||d.defaultOptions]):c.show(new this.MessageBox(t,n,i))},install:function(e){t.showDialog=function(e,t,n){return c.show(e,t,n)},t.showMessage=function(e,t,n){return c.showMessage(e,t,n)},e.messageBox&&(c.MessageBox=e.messageBox),e.messageBoxView&&(c.MessageBox.prototype.getView=function(){return e.messageBoxView})}},c.addContext("default",{blockoutOpacity:.2,removeDelay:200,addHost:function(e){var t=o("body"),n=o('<div class="modalBlockout"></div>').css({"z-index":c.getNextZIndex(),opacity:this.blockoutOpacity}).appendTo(t),i=o('<div class="modalHost"></div>').css({"z-index":c.getNextZIndex()}).appendTo(t);if(e.host=i.get(0),e.blockout=n.get(0),!c.isOpen()){e.oldBodyMarginRight=t.css("margin-right"),e.oldInlineMarginRight=t.get(0).style.marginRight;var r=o("html"),a=t.outerWidth(!0),s=r.scrollTop();o("html").css("overflow-y","hidden");var u=o("body").outerWidth(!0);t.css("margin-right",u-a+parseInt(e.oldBodyMarginRight)+"px"),r.scrollTop(s)}},removeHost:function(e){if(o(e.host).css("opacity",0),o(e.blockout).css("opacity",0),setTimeout(function(){a.removeNode(e.host),a.removeNode(e.blockout)},this.removeDelay),!c.isOpen()){var t=o("html"),n=t.scrollTop();t.css("overflow-y","").scrollTop(n),e.oldInlineMarginRight?o("body").css("margin-right",e.oldBodyMarginRight):o("body").css("margin-right","")}},compositionComplete:function(e,t,n){var i=o(e),r=i.width(),a=i.height(),s=c.getDialog(n.model);i.css({"margin-top":(-a/2).toString()+"px","margin-left":(-r/2).toString()+"px"}),o(s.host).css("opacity",1),o(e).hasClass("autoclose")&&o(s.blockout).click(function(){s.close()}),o(".autofocus",e).each(function(){o(this).focus()})}}),c});
define('viewmodels/order',["services/logger","plugins/router","services/dataContext","plugins/dialog","durandal/app"],function(e,t,r,n,o){var i=ko.observable(!1),a=ko.observable(!1),s=function(t){e.log("Order Detail View Activated",null,"orderDetail",!0);var n=r.getOrderById(parseInt(t,10),b.order),o=r.getProductLookup(b.productsLookup);return Q.all([o,n])},u=function(e){var t={customer:e,viewUrl:"views/billingaddress"};t.closeDialog=function(){n.close(this)},n.show(t)},c=function(e){var t={order:e,viewUrl:"views/shippingaddress"};t.closeDialog=function(){n.close(this)},n.show(t)},d=function(){r.addOrderLine(b.order().OrderID())},l=function(){t.navigateBack()},f=ko.computed(function(){return r.hasChanges()}),g=function(){r.cancelChanges()},v=ko.computed(function(){return f()&&!i()}),p=function(){function e(){i(!1)}return i(!0),r.saveChanges().fin(e)},y=function(){function n(n){function o(){t.navigate("#/orders")}function i(t){g();var r="Error: "+t.message;e.logError(r,t,system.getModuleId(b),!0)}"Yes"===n&&r.deleteOrder(b.order()).then(o).fail(i),a(!1)}var i='Delete Order "'+b.order().OrderID()+'" ?',s="Confirm Delete";return a(!0),o.showMessage(i,s,["Yes","No"]).then(n)},h=function(){function e(e){return"Yes"===e&&g(),e}if(a())return!1;if(f()){var t="Do you want to leave?",r="Navigate away and cancel your changes?";return o.showMessage(r,t,["Yes","No"]).then(e)}return!0},m=function(e){e.entityAspect.setDeleted()},b={activate:s,canDeactivate:h,title:"order",order:ko.observable(),productsLookup:ko.observableArray(),canSave:v,hasChanges:f,goBack:l,save:p,cancel:g,deleteOrder:y,addOrderLine:d,editBillAddress:u,editShipAddress:c,deleteOrderLine:m};return b});
define('viewmodels/orders',["services/logger","plugins/router","services/dataContext"],function(e,t,r){function n(e){var r="#/order/"+e.OrderID;return t.navigate(r),!1}function o(){return e.log("Orders View Activated",null,"orders",!0),r.getOrders().then(function(e){i.orders(e.results)})}var i={activate:o,title:"Orders",orders:ko.observableArray(),gotoOrder:n};return i});
define('viewmodels/shell',["durandal/system","plugins/router","services/logger"],function(e,t,r){function n(){return o()}function o(){return t.map([{route:"",title:"Home",moduleId:"viewmodels/home",nav:!0},{route:"details",moduleId:"viewmodels/details",nav:!0},{route:"orders",moduleId:"viewmodels/orders",nav:!0},{route:"order/:id",moduleId:"viewmodels/order",nav:!1}]).buildNavigationModel(),i("Hot Towel SPA Loaded!",null,!0),t.activate()}function i(t,n,o){r.log(t,n,e.getModuleId(a),o)}var a={activate:n,router:t};return a});
define('text',{load: function(id){throw new Error("Dynamic load not allowed: " + id);}});
define('text!views/billingaddress.html',[],function () { return '<div class="messageBox autoclose" style="max-width: 425px">\r\n\t<div class="modal-header text-center">\r\n\t\t<h3>Edit Billing Address</h3>\r\n\t</div>\r\n\r\n\t<div class="modal-body" data-bind="with: customer">\r\n\t\t<form class="form-horizontal " accept-charset="utf-8">\r\n\t\t\t<div class="control-group">\r\n\t\t\t\t<label class="control-label">\t\r\n\t\t\t\t\tBilling Name\r\n\t\t\t\t</label>\r\n\t\t\t\t<div class="controls">\r\n\t\t\t\t\t<input type="text" data-bind="value: CompanyName">\r\n\t\t\t\t</div>\r\n\t\t\t</div>\r\n \r\n\t\t\t<div class="control-group">\r\n\t\t\t\t<label class="control-label">\t\r\n\t\t\t\t\tStreet Address\r\n\t\t\t\t</label>\r\n\t\t\t\t<div class="controls">\r\n\t\t\t\t\t<input placeholder="Street Name and/or apartment number" type="text" data-bind="value: Address">\r\n\t\t\t\t</div>\r\n\t\t\t</div>\r\n\r\n\t\t\t<div class="control-group">\r\n\t\t\t\t<label class="control-label">\t\r\n\t\t\t\t\tCity\r\n\t\t\t\t</label>\r\n\t\t\t\t<div class="controls">\r\n\t\t\t\t\t<input placeholder="" type="text" data-bind="value: City">\r\n\t\t\t\t</div>\r\n\t\t\t</div>\r\n \r\n\t\t\t<div class="control-group">\r\n\t\t\t\t<label class="control-label">\t\r\n\t\t\t\t\tZip Code\r\n\t\t\t\t</label>\r\n\t\t\t\t<div class="controls"><input type="text" data-bind="value: PostalCode">\r\n\t\t\t\t</div>\r\n\t\t\t</div>\r\n \r\n\t\t\t<div class="control-group">\r\n\t\t\t\t<label class="control-label">\t\r\n\t\t\t\t\tState/Region\r\n\t\t\t\t</label>\r\n\t\t\t\t<div class="controls"><input type="text" data-bind="value: Region">\r\n\t\t\t\t</div>\r\n\t\t\t</div>\r\n\t\t\t\r\n\t\t\t<div class="control-group">\r\n\t\t\t\t<label for="country" class="control-label">\t\r\n\t\t\t\t\tCountry\r\n\t\t\t\t</label>\r\n\t\t\t\t<div class="controls">\r\n\t\t\t\t\t<input type="text" data-bind="value: Country" />\r\n\t\t\t\t</div>\r\n\t\t\t</div>\r\n\t\t</form>\r\n\t</div>\r\n\r\n\t<div class="modal-footer text-center">\r\n\t\t<div class="text-center">\r\n\t\t\t<button class="btn btn-primary" data-bind="click: closeDialog">Close</button>\r\n\t\t</div>\r\n\t</div>\r\n</div>';});

define('text!views/details.html',[],function () { return '<div class="container-fluid">\r\n    <h2 class="page-title" data-bind="text: title"></h2>\r\n</div>';});

define('text!views/home.html',[],function () { return '<div class="container-fluid">\r\n    <h2 class="page-title" data-bind="text: title"></h2>\r\n</div>\r\n';});

define('text!views/nav.html',[],function () { return '<nav class="navbar navbar-static-top">\r\n    <div class="navbar-inner">\r\n        <ul class="nav" data-bind="foreach: router.navigationModel">\r\n            <li data-bind="css: { active: isActive }">\r\n                <a data-bind="attr: { href: hash }, text: title" href="#"></a>\r\n            </li>\r\n        </ul>\r\n        <div data-bind="css: { active: router.isNavigating }" \r\n            class="pull-right loader">\r\n            <i class="icon-spinner icon-2x icon-spin"></i>\r\n        </div>\r\n    </div>\r\n</nav>';});

define('text!views/order.html',[],function () { return '<div class="container-fluid">\r\n\r\n    <div class="row-fluid">\r\n        <div class="form-actions">\r\n            <button class="btn btn-inverse"\r\n                data-bind="click: goBack"><i class="icon-hand-left icon-white"></i> Back</button>\r\n            <button class="btn btn-inverse"\r\n                data-bind="click: cancel, enable: canSave"><i class="icon-undo icon-white"></i> Cancel</button>\r\n            <button class="btn btn-primary"\r\n                data-bind="click: save, enable: canSave"><i class="icon-save icon-white"></i> Save</button>\r\n        \r\n            <i class="icon-asterisk icon-red" data-bind="visible: hasChanges"></i>\r\n        \r\n            <button class="btn btn-danger pull-right"\r\n                data-bind="click: deleteOrder, disable: hasChanges"><i class="icon-trash icon-white"></i> Delete\r\n            </button>\r\n        </div>\r\n    </div>\r\n    <div class="row-fluid" data-bind="with: order">\r\n        <div class="span12 well">   \r\n            <fieldset class="span3" data-bind="with: Customer">\r\n                <legend class="muted">\r\n                    Billing Address \r\n                    <button class="btn btn-inverse btn-mini" data-bind="click: $root.editBillAddress">Edit</button>\r\n                </legend>\r\n                <strong data-bind="text: CompanyName"></strong><br />\r\n                <span data-bind="text: Address"></span><br />\r\n                <span data-bind="text: City"></span>, <span data-bind="text: Region"></span> <span data-bind="text: PostalCode"></span><br />\r\n                <span data-bind="text: Country"></span><br />\r\n            </fieldset>\r\n            <fieldset class="span3">\r\n                <legend class="muted">\r\n                    Shipping Address \r\n                    <button class="btn btn-inverse btn-mini" data-bind="click: $parent.editShipAddress">Edit</button>\r\n                </legend>\r\n                <strong data-bind="text:ShipName"></strong><br />\r\n                <span data-bind="text: ShipAddress"></span><br />\r\n                <span data-bind="text: ShipCity"></span>, <span data-bind="text: ShipRegion"></span> <span data-bind="text: ShipPostalCode"></span><br />\r\n                <span data-bind="text: ShipCountry"></span><br />\r\n            </fieldset>\r\n            <div class="span3 offset1">\r\n                <label><strong>Order Date</strong></label>\r\n                <div class="input-append">\r\n                    <input type="text" class="input-small" data-bind="datepicker: {}, dateString: OrderDate" />\r\n                    <span class="add-on"><i class="icon-calendar"></i></span>\r\n                </div>\r\n                <label><strong>Required Date</strong></label>\r\n                <div class="input-append">\r\n                    <input type="text" class="input-small" data-bind="datepicker: {}, dateString: RequiredDate" />\r\n                    <span class="add-on"><i class="icon-calendar"></i></span>\r\n                </div>\r\n            </div>\r\n            <h4 class="span2 muted text-right"><i>Order #</i><i data-bind="text: OrderID"></i></h4>\r\n        </div>\r\n    </div>\r\n    <div class="row-fluid">\r\n        <table class="table table-bordered table-edit table-striped">\r\n            <thead>\r\n                <tr class="info">\r\n                    <th>Product</th>\r\n                    <th>Price</th>\r\n                    <th>Quantity</th>\r\n                    <th>Total</th>\r\n                    <th></th>\r\n                </tr>\r\n            </thead>\r\n            <tbody data-bind="foreach: order().OrderDetails">\r\n                <tr data-bind="css: { error: !isValid() }">\r\n                    <td>\r\n                        <select class="input-xlarge" data-bind="options: $root.productsLookup, optionsText: \'ProductName\', optionsValue: \'ProductID\', value: ProductID, optionsCaption: \'Choose...\'"></select>\r\n                    </td>\r\n                    <td>\r\n                        <div class="input-prepend">\r\n                            <span class="add-on">$</span>\r\n                            <input type="text" class="input-mini text-right" data-bind="value: UnitPrice, valueUpdate: \'afterkeydown\'" />\r\n                        </div>\r\n                    </td>\r\n                    <td>\r\n                        <input type="text" class="input-mini text-right" data-bind="value: Quantity, valueUpdate: \'afterkeydown\'" />\r\n                    </td>\r\n                    <td><div class="text-right" data-bind="text: rowtotal.formatted"></div></td>\r\n                    <td>\r\n                        <button class="btn btn-sm pull-right" data-bind="click: $root.deleteOrderLine"><i class="icon-remove icon-red icon-large"></i></button>\r\n                    </td>\r\n                </tr>\r\n            </tbody>\r\n            <tfoot>\r\n                <tr>\r\n                    <td colspan="3">\r\n                        <button class="btn btn-success pull-left" data-bind=\'click: addOrderLine\'><i class="icon-plus icon-white"></i> Add Line</button>\r\n                        <div class="text-right muted">\r\n                            <strong>Grand Total: </strong>\r\n                        </div>\r\n                    </td>\r\n                    <td>\r\n                        <div class="text-right">\r\n                            <strong data-bind="text: order().grandtotal.formatted"></strong>\r\n                        </div>\r\n                    </td>\r\n                    <td></td>\r\n                </tr>\r\n            </tfoot>\r\n        </table>\r\n        \r\n    </div>\r\n</div>';});

define('text!views/orders.html',[],function () { return '<div class="container-fluid">\r\n    <h2 class="page-title" data-bind="text: title"></h2>    \r\n\r\n    <table class="table table-hover table-striped table-bordered">\r\n        <thead>\r\n            <tr>\r\n                <th>Id</th>\r\n                <th>Date</th>\r\n                <th>Customer</th>\r\n            </tr>\r\n        </thead>\r\n        <tbody data-bind="foreach: orders">\r\n            <tr data-bind="click: $root.gotoOrder">\r\n                <td data-bind="text: OrderID"></td>\r\n                <td data-bind="text: moment(OrderDate).format(\'LL\')"></td>\r\n                <td data-bind="text: Customer_CompanyName"></td>\r\n            </tr>\r\n        </tbody>\r\n    </table>\r\n</div>';});

define('text!views/shell.html',[],function () { return '<div>\r\n    <header>\r\n        <!--ko compose: {view: \'nav\'} --><!--/ko-->\r\n    </header>\r\n     <section id="content">\r\n        <!--ko router: {\r\n            afterCompose: router.afterCompose, \r\n            transition: \'entrance\'} -->\r\n        <!--/ko-->\r\n    </section>\r\n</div>\r\n';});

define('text!views/shippingaddress.html',[],function () { return '<div class="messageBox autoclose" style="max-width: 425px">\r\n\t<div class="modal-header text-center">\r\n\t\t<h3>Edit Shipping Address</h3>\r\n\t</div>\r\n\r\n\t<div class="modal-body" data-bind="with: order">\r\n\t\t<form class="form-horizontal " accept-charset="utf-8">\r\n\t\t\t<div class="control-group">\r\n\t\t\t\t<label class="control-label">\t\r\n\t\t\t\t\tShipping Name\r\n\t\t\t\t</label>\r\n\t\t\t\t<div class="controls">\r\n\t\t\t\t\t<input type="text" data-bind="value: ShipName">\r\n\t\t\t\t</div>\r\n\t\t\t</div>\r\n \r\n\t\t\t<div class="control-group">\r\n\t\t\t\t<label class="control-label">\t\r\n\t\t\t\t\tStreet Address\r\n\t\t\t\t</label>\r\n\t\t\t\t<div class="controls">\r\n\t\t\t\t\t<input placeholder="Street Name and/or apartment number" type="text" data-bind="value: ShipAddress">\r\n\t\t\t\t</div>\r\n\t\t\t</div>\r\n\r\n\t\t\t<div class="control-group">\r\n\t\t\t\t<label class="control-label">\t\r\n\t\t\t\t\tCity\r\n\t\t\t\t</label>\r\n\t\t\t\t<div class="controls">\r\n\t\t\t\t\t<input placeholder="" type="text" data-bind="value: ShipCity">\r\n\t\t\t\t</div>\r\n\t\t\t</div>\r\n \r\n\t\t\t<div class="control-group">\r\n\t\t\t\t<label class="control-label">\t\r\n\t\t\t\t\tZip Code\r\n\t\t\t\t</label>\r\n\t\t\t\t<div class="controls"><input type="text" data-bind="value: ShipPostalCode">\r\n\t\t\t\t</div>\r\n\t\t\t</div>\r\n \r\n\t\t\t<div class="control-group">\r\n\t\t\t\t<label class="control-label">\t\r\n\t\t\t\t\tState/Region\r\n\t\t\t\t</label>\r\n\t\t\t\t<div class="controls"><input type="text" data-bind="value: ShipRegion">\r\n\t\t\t\t</div>\r\n\t\t\t</div>\r\n\t\t\t\r\n\t\t\t<div class="control-group">\r\n\t\t\t\t<label for="country" class="control-label">\t\r\n\t\t\t\t\tCountry\r\n\t\t\t\t</label>\r\n\t\t\t\t<div class="controls">\r\n\t\t\t\t\t<input type="text" data-bind="value: ShipCountry" />\r\n\t\t\t\t</div>\r\n\t\t\t</div>\r\n\t\t</form>\r\n\t</div>\r\n\r\n\t<div class="modal-footer text-center">\r\n\t\t<div class="text-center">\r\n\t\t\t<button class="btn btn-primary" data-bind="click: closeDialog">Close</button>\r\n\t\t</div>\r\n\t</div>\r\n</div>';});

define('plugins/http',["jquery","knockout"],function(e,t){return{callbackParam:"callback",get:function(t,n){return e.ajax(t,{data:n})},jsonp:function(t,n,i){return-1==t.indexOf("=?")&&(i=i||this.callbackParam,t+=-1==t.indexOf("?")?"?":"&",t+=i+"=?"),e.ajax({url:t,dataType:"jsonp",data:n})},post:function(n,i){return e.ajax({url:n,data:t.toJSON(i),type:"POST",contentType:"application/json",dataType:"json"})}}});
define('plugins/observable',["durandal/system","durandal/binder","knockout"],function(e,t,n){function r(e){var t=e[0];return"_"===t||"$"===t}function i(t){if(!t||e.isElement(t)||t.ko===n||t.jquery)return!1;var r=d.call(t);return-1==f.indexOf(r)&&!(t===!0||t===!1)}function a(e,t){var n=e.__observable__,r=!0;if(!n||!n.__full__){n=n||(e.__observable__={}),n.__full__=!0,v.forEach(function(n){e[n]=function(){r=!1;var e=m[n].apply(t,arguments);return r=!0,e}}),g.forEach(function(n){e[n]=function(){r&&t.valueWillMutate();var i=h[n].apply(e,arguments);return r&&t.valueHasMutated(),i}}),p.forEach(function(n){e[n]=function(){for(var i=0,a=arguments.length;a>i;i++)o(arguments[i]);r&&t.valueWillMutate();var s=h[n].apply(e,arguments);return r&&t.valueHasMutated(),s}}),e.splice=function(){for(var n=2,i=arguments.length;i>n;n++)o(arguments[n]);r&&t.valueWillMutate();var a=h.splice.apply(e,arguments);return r&&t.valueHasMutated(),a};for(var i=0,a=e.length;a>i;i++)o(e[i])}}function o(t){var o,s;if(i(t)&&(o=t.__observable__,!o||!o.__full__)){if(o=o||(t.__observable__={}),o.__full__=!0,e.isArray(t)){var u=n.observableArray(t);a(t,u)}else for(var l in t)r(l)||o[l]||(s=t[l],e.isFunction(s)||c(t,l,s));y&&e.log("Converted",t)}}function s(e,t,n){var r;e(t),r=e.peek(),n?r.destroyAll||(r||(r=[],e(r)),a(r,e)):o(r)}function c(t,r,i){var c,u,l=t.__observable__||(t.__observable__={});if(void 0===i&&(i=t[r]),e.isArray(i))c=n.observableArray(i),a(i,c),u=!0;else if("function"==typeof i){if(!n.isObservable(i))return null;c=i}else e.isPromise(i)?(c=n.observable(),i.then(function(t){if(e.isArray(t)){var r=n.observableArray(t);a(t,r),t=r}c(t)})):(c=n.observable(i),o(i));return Object.defineProperty(t,r,{configurable:!0,enumerable:!0,get:c,set:n.isWriteableObservable(c)?function(t){t&&e.isPromise(t)?t.then(function(t){s(c,t,e.isArray(t))}):s(c,t,u)}:void 0}),l[r]=c,c}function u(t,n,r){var i,a=this,o={owner:t,deferEvaluation:!0};return"function"==typeof r?o.read=r:("value"in r&&e.error('For ko.defineProperty, you must not specify a "value" for the property. You must provide a "get" function.'),"function"!=typeof r.get&&e.error('For ko.defineProperty, the third parameter must be either an evaluator function, or an options object containing a function called "get".'),o.read=r.get,o.write=r.set),i=a.computed(o),t[n]=i,c(t,n,i)}var l,d=Object.prototype.toString,f=["[object Function]","[object String]","[object Boolean]","[object Number]","[object Date]","[object RegExp]"],v=["remove","removeAll","destroy","destroyAll","replace"],g=["pop","reverse","sort","shift","splice"],p=["push","unshift"],h=Array.prototype,m=n.observableArray.fn,y=!1;return l=function(e,t){var r,i,a;return e?(r=e.__observable__,r&&(i=r[t])?i:(a=e[t],n.isObservable(a)?a:c(e,t,a))):null},l.defineProperty=u,l.convertProperty=c,l.convertObject=o,l.install=function(e){var n=t.binding;t.binding=function(e,t,r){r.applyBindings&&!r.skipConversion&&o(e),n(e,t)},y=e.logConversion},l});
define('plugins/serializer',["durandal/system"],function(e){return{typeAttribute:"type",space:void 0,replacer:function(e,t){if(e){var n=e[0];if("_"===n||"$"===n)return void 0}return t},serialize:function(t,n){return n=void 0===n?{}:n,(e.isString(n)||e.isNumber(n))&&(n={space:n}),JSON.stringify(t,n.replacer||this.replacer,n.space||this.space)},getTypeId:function(e){return e?e[this.typeAttribute]:void 0},typeMap:{},registerType:function(){var t=arguments[0];if(1==arguments.length){var n=t[this.typeAttribute]||e.getModuleId(t);this.typeMap[n]=t}else this.typeMap[t]=arguments[1]},reviver:function(e,t,n,r){var i=n(t);if(i){var o=r(i);if(o)return o.fromJSON?o.fromJSON(t):new o(t)}return t},deserialize:function(e,t){var n=this;t=t||{};var r=t.getTypeId||function(e){return n.getTypeId(e)},i=t.getConstructor||function(e){return n.typeMap[e]},o=t.reviver||function(e,t){return n.reviver(e,t,r,i)};return JSON.parse(e,o)}}});
define('plugins/widget',["durandal/system","durandal/composition","jquery","knockout"],function(e,t,n,r){function i(e,n){var i=r.utils.domData.get(e,s);i||(i={parts:t.cloneNodes(r.virtualElements.childNodes(e))},r.virtualElements.emptyNode(e),r.utils.domData.set(e,s,i)),n.parts=i.parts}var o={},a={},u=["model","view","kind"],s="durandal-widget-data",c={getSettings:function(t){var n=r.utils.unwrapObservable(t())||{};if(e.isString(n))return{kind:n};for(var i in n)n[i]=-1!=r.utils.arrayIndexOf(u,i)?r.utils.unwrapObservable(n[i]):n[i];return n},registerKind:function(e){r.bindingHandlers[e]={init:function(){return{controlsDescendantBindings:!0}},update:function(t,n,r,o,a){var u=c.getSettings(n);u.kind=e,i(t,u),c.create(t,u,a,!0)}},r.virtualElements.allowedBindings[e]=!0},mapKind:function(e,t,n){t&&(a[e]=t),n&&(o[e]=n)},mapKindToModuleId:function(e){return o[e]||c.convertKindToModulePath(e)},convertKindToModulePath:function(e){return"widgets/"+e+"/viewmodel"},mapKindToViewId:function(e){return a[e]||c.convertKindToViewPath(e)},convertKindToViewPath:function(e){return"widgets/"+e+"/view"},createCompositionSettings:function(e,t){return t.model||(t.model=this.mapKindToModuleId(t.kind)),t.view||(t.view=this.mapKindToViewId(t.kind)),t.preserveContext=!0,t.activate=!0,t.activationData=t,t.mode="templated",t},create:function(e,n,r,i){i||(n=c.getSettings(function(){return n},e));var o=c.createCompositionSettings(e,n);t.compose(e,o,r)},install:function(e){if(e.bindingName=e.bindingName||"widget",e.kinds)for(var t=e.kinds,n=0;n<t.length;n++)c.registerKind(t[n]);r.bindingHandlers[e.bindingName]={init:function(){return{controlsDescendantBindings:!0}},update:function(e,t,n,r,o){var a=c.getSettings(t);i(e,a),c.create(e,a,o,!0)}},r.virtualElements.allowedBindings[e.bindingName]=!0}};return c});
define('transitions/entrance',["durandal/system","durandal/composition","jquery"],function(e,t,n){var r=100,i={marginRight:0,marginLeft:0,opacity:1},o={marginLeft:"",marginRight:"",opacity:"",display:""},a=function(t){return e.defer(function(e){function a(){e.resolve()}function u(){t.keepScrollPosition||n(document).scrollTop(0)}function c(){u(),t.triggerAttach();var e={marginLeft:l?"0":"20px",marginRight:l?"0":"-20px",opacity:0,display:"block"},r=n(t.child);r.css(e),r.animate(i,s,"swing",function(){r.css(o),a()})}if(t.child){var s=t.duration||500,l=!!t.fadeOnly;t.activeView?n(t.activeView).fadeOut(r,c):c()}else n(t.activeView).fadeOut(r,a)}).promise()};return a});
require(["main"]);
}());