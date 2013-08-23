define(function () {
    return { registerExtenders: registerExtenders };

    function registerExtenders() {
        (function () {
            var format = function (value) {
                toks = value.toFixed(2).replace('-', '').split('.');
                var display = '$' + $.map(toks[0].split('').reverse(), function (elm, i) {
                    return [(i % 3 === 0 && i > 0 ? ',' : ''), elm];
                }).reverse().join('') + '.' + toks[1];

                return value < 0 ? '(' + display + ')' : display;
            };

            ko.subscribable.fn.money = function () {
                var target = this;

                var writeTarget = function (value) {
                    target(parseFloat(value.replace(/[^0-9.-]/g, '')));
                };

                var result = ko.computed({
                    read: function () {
                        return target();
                    },
                    write: writeTarget
                });

                result.formatted = ko.computed({
                    read: function () {
                        return format(target());
                    },
                    write: writeTarget
                });

                return result;
            };
        })();
    }
});


//Credit to Josh Bush
//http://freshbrewedcode.com/joshbush/2011/12/27/knockout-js-observable-extensions/