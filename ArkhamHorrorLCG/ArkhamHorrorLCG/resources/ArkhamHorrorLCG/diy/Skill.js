/* global useLibrary, sourcefile, testDIYScript, globalThis */
useLibrary('amd');

if (String(sourcefile) === 'Quickscript') {
    define.config({
        baseUrl: 'project:ArkhamHorrorLCG/resources/ArkhamHorrorLCG/diy',
    });
}

// A player skill with a player or encounter card back.
define([
    'handlers/exportHandler',
    'handlers/FaceChoiceHandler',
    'handlers/PlayerBacks',
    'faces/SkillFace',
], function (exportHandler, FaceChoiceHandler, PlayerBacks, SkillFace) {
    exportHandler(
        globalThis,
        new FaceChoiceHandler({
            // the legacy template keys, which saved cards keep
            templateKeys: ['AHLCG-Skill-Default', 'AHLCG-SkillBack-Default'],
            settings: [null, 'BackTypeBack'],
            choices: [
                [{ id: 'Skill', label: 'AHLCG-Face-skill', face: SkillFace }],
                PlayerBacks.Backs,
            ],
            title: 'AHLCG-Template',
            legacyPortraits: [[0, 'Portrait'], 'Collection', 'Encounter'],
            upgradeChoices: function (diy) {
                if (diy.version < 16) diy.settings.reset('BackStatBack');
                PlayerBacks.upgrade(diy.settings);
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
