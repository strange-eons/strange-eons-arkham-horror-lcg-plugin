/* global useLibrary, sourcefile, testDIYScript, globalThis */
useLibrary('amd');

if (String(sourcefile) === 'Quickscript') {
    define.config({
        baseUrl: 'project:ArkhamHorrorLCG/resources/ArkhamHorrorLCG/diy',
    });
}

// An ultimatum or boon: full bleed art and template, with a refraction
// template when it has a subtitle.
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

    function UltimatumHandler() {
        LegacyHandler.call(
            this,
            ['Ultimatum', 'UltimatumBack'],
            ['', 'Back'],
            ['Portrait', 'Collection', 'Encounter']
        );
    }
    UltimatumHandler.prototype = Object.create(LegacyHandler.prototype);
    UltimatumHandler.prototype.constructor = UltimatumHandler;

    UltimatumHandler.prototype.create = function (diy) {
        this.attach(diy);
        diy.frontTemplateKey = this.key(FACE_FRONT, 'Default', '-template');
        diy.backTemplateKey = this.key(FACE_BACK, 'Default', '-template');
        diy.faceStyle = diyLibrary.FaceStyle.TWO_FACES;
        diy.name = '';

        this.setDefaults(diy);
        this.createPortraits(diy);
        this.setDefaultEncounter(diy);
        this.setDefaultCollection(diy);

        diy.setCornerRadius(8);
        diy.version = LegacyHandler.CARD_VERSION;
    };

    UltimatumHandler.prototype.setDefaults = function (diy) {
        var values = {
            Subtitle: '',
            BackTypeBack: 'Boon',
            Traits: '',
            Rules: '',
            TraitsSpacing: '0',
            RulesSpacing: '0',
            Artist: '',
            Copyright: '',
        };
        for (let key in values) diy.settings.set(key, values[key]);
    };

    UltimatumHandler.prototype.createInterface = function (diy, editor) {
        var bindings = new ui.Bindings(editor, diy);

        var title = this.layoutTitleUnique(diy, bindings, true, [0], FACE_FRONT);
        var copyright = this.layoutCopyright(bindings, false, [0]);
        var general = new ui.Grid();
        general.editorTabScrolling = true;
        general.place(
            title,
            'wrap, pushx, growx',
            copyright,
            'wrap, pushx, growx'
        );
        general.addToEditor(editor, string('AHLCG-General'));

        var text = this.layoutText(bindings, ['Traits', 'Rules'], '', FACE_FRONT);
        text.editorTabScrolling = true;
        text.addToEditor(editor, string('AHLCG-Rules'));

        this.layoutPortraits(
            diy,
            bindings,
            'Portrait',
            null,
            false,
            false,
            false
        )[0].addToEditor(editor, string('AHLCG-Portraits'));

        var collectionImage = new ui.portraitPanel(
            diy,
            this.portraitIndex('Collection'),
            string('AHLCG-CustomCollection')
        );
        var collection = new ui.Grid();
        collection.editorTabScrolling = true;
        collection.place(
            this.layoutCollection(
                bindings,
                collectionImage,
                false,
                false,
                [0],
                FACE_FRONT
            ),
            'wrap, pushx, growx',
            collectionImage,
            'wrap, pushx, growx'
        );
        collection.addToEditor(editor, string('AHLCG-Collection'));

        var encounterImage = new ui.portraitPanel(
            diy,
            this.portraitIndex('Encounter'),
            string('AHLCG-CustomEncounterSet')
        );
        var encounter = new ui.Grid();
        encounter.editorTabScrolling = true;
        encounter.place(
            this.layoutEncounter(
                bindings,
                encounterImage,
                false,
                [0],
                [0],
                FACE_FRONT
            ),
            'wrap, pushx, growx',
            encounterImage,
            'wrap, pushx, growx'
        );
        encounter.addToEditor(editor, string('AHLCG-EncounterSet'));

        bindings.bind();
    };

    UltimatumHandler.prototype.createFrontPainter = function (diy, sheet) {
        var b = this.boxes;
        b.Name = this.box(diy, sheet, 'Name');
        this.initBodyTags(diy, b.Name);
        b.Subtitle = this.box(diy, sheet, 'Subtitle');
        b.Trait = this.box(diy, sheet, 'Trait');
        b.Body = this.box(diy, sheet, 'Body');
        this.initBodyTags(diy, b.Body);
        b.Artist = this.box(diy, sheet, 'Artist');
        b.Copyright = this.box(diy, sheet, 'Copyright');
        this.initCopyrightTags(diy, b.Copyright);
        b.Collection = this.box(diy, sheet, 'CollectionNumber');
        b.Encounter = this.box(diy, sheet, 'EncounterNumber');
    };

    UltimatumHandler.prototype.createBackPainter = function () {};

    UltimatumHandler.prototype.paintFront = function (g, diy, sheet) {
        var b = this.boxes;
        var subtitle = this.get('Subtitle');
        var traits = this.get('Traits');

        this.clearImage(g, sheet);
        this.paintPortrait(g, diy, sheet, 'Portrait');
        this.drawFullBleed(
            g,
            sheet,
            (traits.indexOf('Boon') > -1 ? 'Boon' : 'Ultimatum') +
                '-' +
                (subtitle.length === 0 ? 'Common' : 'Refraction')
        );
        this.drawName(g, diy, sheet, b.Name);
        this.drawLine(g, diy, sheet, b.Subtitle, 'Subtitle', subtitle);
        this.drawLine(g, diy, sheet, b.Trait, 'Trait', traits);
        this.drawBody(g, diy, sheet, b.Body, ['Rules']);
        this.drawCollectorInfo(
            g,
            diy,
            sheet,
            b.Collection,
            true,
            b.Encounter,
            true,
            b.Copyright,
            b.Artist
        );
    };

    UltimatumHandler.prototype.paintBack = function (g, diy, sheet) {
        this.clearImage(g, sheet);
        this.drawBackTemplate(g, sheet);
    };

    UltimatumHandler.prototype.onClear = function (diy) {
        this.setDefaults(diy);
    };

    UltimatumHandler.prototype.onRead = function (diy, ois) {
        this.attach(diy);
        this.readPortraits(diy, ois);
        this.updateCollection(diy);
        this.updateEncounter(diy);
        diy.setCornerRadius(8);
        diy.version = LegacyHandler.CARD_VERSION;
    };

    exportHandler(globalThis, new UltimatumHandler());
});

// Running this script directly (Quickscript) creates a test editor for the
// component; saving and loading it won't work correctly.
if (String(sourcefile) === 'Quickscript') {
    useLibrary('diy');
    testDIYScript();
}
