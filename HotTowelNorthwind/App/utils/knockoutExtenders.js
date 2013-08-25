define(function () {
    return { registerExtenders: registerExtenders };

    function registerExtenders() {
        RegisterDateBinding();
        RegisterMoneyExtension();
    }


    function RegisterDateBinding () {
        ko.bindingHandlers.dateString = {
            //Credit to Ryan Rahlf http://stackoverflow.com/questions/17001303/date-formatting-issues-with-knockout-and-syncing-to-breeze-js-entityaspect-modif
            init: function (element, valueAccessor) {
                //attach an event handler to our dom element to handle user input
                element.onchange = function () {
                    var value = valueAccessor();//get our observable
                    //set our observable to the parsed date from the input
                    value(moment(element.value).toDate());
                };
            },
            update: function (element, valueAccessor, allBindingsAccessor, viewModel) {
                var value = valueAccessor();
                var valueUnwrapped = ko.utils.unwrapObservable(value);
                if (valueUnwrapped) {
                    element.value = moment(valueUnwrapped).format('L');
                }
            }
        };
    }




    function RegisterMoneyExtension() {
        //Credit to Josh Bush http://freshbrewedcode.com/joshbush/2011/12/27/knockout-js-observable-extensions/
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
    }





});


