/* global useLibrary, sourcefile, testDIYScript, globalThis */
useLibrary('amd');

if (String(sourcefile) === 'Quickscript') {
    define.config({
        baseUrl: 'project:ArkhamHorrorLCG/resources/ArkhamHorrorLCG/diy',
    });
}

// A divider: the same template, title and encounter icon on both sides.
define([
    'handlers/exportHandler',
    'legacy/LegacyHandler',
    'se/diy',
    'se/strings',
    'se/ui',
], function (exportHandler, LegacyHandler, diyLibrary, strings, ui) {
    const FACE_FRONT = LegacyHandler.FACE_FRONT;
    const FACE_BACK = LegacyHandler.FACE_BACK;
    const string = strings.string;

    function DividerHandler() {
        LegacyHandler.call(
            this,
            ['Divider', 'Divider'],
            ['', 'Back'],
            ['Encounter-Both']
        );
    }
    DividerHandler.prototype = Object.create(LegacyHandler.prototype);
    DividerHandler.prototype.constructor = DividerHandler;

    DividerHandler.prototype.create = function (diy) {
        this.attach(diy);
        diy.frontTemplateKey = this.key(FACE_FRONT, 'Default', '-template');
        diy.backTemplateKey = this.key(FACE_BACK, 'Default', '-template');
        diy.faceStyle = diyLibrary.FaceStyle.TWO_FACES;
        diy.name = '';

        this.createPortraits(diy);
        this.setDefaultEncounter(diy);

        diy.version = LegacyHandler.CARD_VERSION;
    };

    DividerHandler.prototype.createInterface = function (diy, editor) {
        var bindings = new ui.Bindings(editor, diy);

        var general = new ui.Grid();
        general.editorTabScrolling = true;
        general.place(
            this.layoutTitle(diy, bindings, false, [0, 1], FACE_FRONT),
            'wrap, pushx, growx'
        );
        general.addToEditor(editor, string('AHLCG-General'));

        var encounterImage = new ui.portraitPanel(
            diy,
            this.portraitIndex('Encounter'),
            string('AHLCG-CustomEncounterSet')
        );
        var encounter = new ui.Grid();
        encounter.editorTabScrolling = true;
        encounter.place(
            this.layoutSimpleEncounter(
                bindings,
                encounterImage,
                [0, 1],
                FACE_FRONT
            ),
            'wrap, pushx, growx',
            encounterImage,
            'wrap, pushx, growx'
        );
        encounter.addToEditor(editor, string('AHLCG-EncounterSet'));

        bindings.bind();
    };

    DividerHandler.prototype.createFrontPainter = function (diy, sheet) {
        this.boxes.Name = this.box(diy, sheet, 'Name');
        this.initBodyTags(diy, this.boxes.Name);
    };

    DividerHandler.prototype.createBackPainter = function () {};

    // both sides draw the front's title box
    DividerHandler.prototype.paintFront = function (g, diy, sheet) {
        this.clearImage(g, sheet);
        this.drawTemplate(g, sheet);
        if (String(diy.name) !== '')
            this.drawName(g, diy, sheet, this.boxes.Name);
        this.drawEncounterIcon(g, diy, sheet);
        this.drawWatermark(g, diy, sheet);
    };

    DividerHandler.prototype.paintBack = DividerHandler.prototype.paintFront;

    DividerHandler.prototype.onClear = function () {};

    DividerHandler.prototype.onRead = function (diy, ois) {
        this.attach(diy);
        this.readPortraits(diy, ois);
        this.updateEncounter(diy);
        diy.version = LegacyHandler.CARD_VERSION;
    };

    exportHandler(globalThis, new DividerHandler());
});

// Running this script directly (Quickscript) creates a test editor for the
// component; saving and loading it won't work correctly.
if (String(sourcefile) === 'Quickscript') {
    useLibrary('diy');
    testDIYScript();
}
