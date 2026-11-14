// Strange Eons extension library: game registration and the extension
// plug-in type.
//
// Module: returns { Game, ClassMap, ConversionMap, getPluginType }.
/* global useLibrary, Game, ClassMap, ConversionMap, getPluginType */
useLibrary('extension');

define(function () {
    return {
        Game: Game,
        ClassMap: ClassMap,
        ConversionMap: ConversionMap,
        getPluginType: getPluginType,
    };
});
