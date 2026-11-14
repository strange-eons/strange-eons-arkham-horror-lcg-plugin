// Exports a handler object as the script functions Strange Eons calls for a
// DIY component. Strange Eons looks each function up by name when it calls
// it, so the exported functions forward to the object's methods, inherited
// ones included.
//
// Module: returns exportHandler( scope, handler ), where scope is the handler
// script's global scope.
define([], function () {
    // the DIY Handler, PortraitProvider and conversion functions
    const HandlerMethods = [
        'create',
        'createInterface',
        'createFrontPainter',
        'createBackPainter',
        'paintFront',
        'paintBack',
        'onClear',
        'onRead',
        'onWrite',
        'getPortraitCount',
        'getPortrait',
        'onConvertFrom',
        'onConvertTo',
    ];

    return function exportHandler(scope, handler) {
        HandlerMethods.forEach(function (name) {
            if (typeof handler[name] !== 'function') return;
            scope[name] = function () {
                return handler[name].apply(handler, arguments);
            };
        });
    };
});
