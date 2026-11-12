/* global useLibrary, sourcefile, testDIYScript, globalThis */
useLibrary('amd');

if (String(sourcefile) === 'Quickscript') {
    define.config({
        baseUrl: 'project:ArkhamHorrorLCG/resources/ArkhamHorrorLCG/diy',
    });
}

// A story asset with art on its back.
define([
    'handlers/exportHandler',
    'handlers/LegacyStoryAsset',
    'handlers/ShimHandler',
    'faces/AssetFace',
    'faces/PortraitFace',
], function (
    exportHandler,
    LegacyStoryAsset,
    ShimHandler,
    AssetFace,
    PortraitFace
) {
    exportHandler(
        globalThis,
        new ShimHandler({
            // the legacy template keys, which saved cards keep
            templateKeys: [
                'AHLCG-AssetStory-Default',
                'AHLCG-BackPortrait-Default',
            ],
            faces: [AssetFace, PortraitFace],
            legacyPortraits: [
                [0, 'Portrait'],
                [1, 'Portrait'],
                'Collection',
                'Encounter',
            ],
            cardDefaults: { CardClass: 'Story' },
            upgrade: function (diy) {
                // legacy story assets were Neutral or Weakness
                LegacyStoryAsset.upgrade(diy.settings, '');
                if (diy.version < 16) {
                    diy.settings.reset('BackTypeundefined');
                    diy.settings.reset('BackTypeBack');
                }
            },
        })
    );
});

// Running this script directly (Quickscript) creates a test editor for the
// component; saving and loading it won't work correctly.
if (String(sourcefile) === 'Quickscript') {
    useLibrary('diy');
    testDIYScript();
}
