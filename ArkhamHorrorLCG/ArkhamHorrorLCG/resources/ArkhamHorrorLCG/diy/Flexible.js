/* global useLibrary, sourcefile, testDIYScript, globalThis */
useLibrary('amd');

if (String(sourcefile) === 'Quickscript') {
    define.config({
        baseUrl: 'project:ArkhamHorrorLCG/resources/ArkhamHorrorLCG/diy',
    });
}

// A card whose faces are chosen in the editor. $FrontFace and $BackFace hold
// the chosen face ids; any face can be used on either side.
define([
    'handlers/exportHandler',
    'handlers/FaceChoiceHandler',
    'handlers/FlexibleFaces',
], function (exportHandler, FaceChoiceHandler, FlexibleFaces) {
    const Choices = FlexibleFaces.choices;

    exportHandler(
        globalThis,
        new FaceChoiceHandler({
            templateKeys: [
                'AHLCG-FlexibleHandler-Front',
                'AHLCG-FlexibleHandler-Back',
            ],
            settings: ['FrontFace', 'BackFace'],
            choices: [Choices, Choices],
            defaults: ['playerBack', 'encounterBack'],
            title: 'AHLCG-Faces',
        })
    );
});

// Running this script directly (Quickscript) creates a test editor for the
// component; saving and loading it won't work correctly.
if (String(sourcefile) === 'Quickscript') {
    useLibrary('diy');
    testDIYScript();
}
