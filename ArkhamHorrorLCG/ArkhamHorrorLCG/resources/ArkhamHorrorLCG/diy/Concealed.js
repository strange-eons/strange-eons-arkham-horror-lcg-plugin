/* global useLibrary, sourcefile, testDIYScript, globalThis */
useLibrary('amd');

if (String(sourcefile) === 'Quickscript') {
    define.config({
        baseUrl: 'project:ArkhamHorrorLCG/resources/ArkhamHorrorLCG/diy',
    });
}

// A concealed mini card: art, a template and a two line title.
define([
    'handlers/exportHandler',
    'legacy/LegacyHandler',
    'se/diy',
    'se/strings',
    'se/ui',
], function (exportHandler, LegacyHandler, diyLibrary, strings, ui) {
    const FACE_FRONT = LegacyHandler.FACE_FRONT;
    const FACE_BACK = LegacyHandler.FACE_BACK;
    const FaceStyle = diyLibrary.FaceStyle;
    const string = strings.string;

    function ConcealedHandler() {
        LegacyHandler.call(
            this,
            ['Concealed', 'ConcealedBack'],
            ['', 'Back'],
            ['Portrait-Front']
        );
    }
    ConcealedHandler.prototype = Object.create(LegacyHandler.prototype);
    ConcealedHandler.prototype.constructor = ConcealedHandler;

    ConcealedHandler.prototype.create = function (diy) {
        this.attach(diy);
        diy.frontTemplateKey = this.key(FACE_FRONT, 'Default', '-template');
        diy.backTemplateKey = this.key(FACE_BACK, 'Default', '-template');
        diy.faceStyle = FaceStyle.TWO_FACES;
        diy.name = '';

        this.setDefaults(diy);
        this.createPortraits(diy);

        diy.setCornerRadius(8);
        diy.version = LegacyHandler.CARD_VERSION;
    };

    ConcealedHandler.prototype.setDefaults = function (diy) {
        var values = {
            Copyright: '',
            Template: 'Standard',
            BackTypeBack: 'Concealed',
            TemplateReplacement: '',
            TemplateReplacementBack: '',
        };
        for (let key in values) diy.settings.set(key, values[key]);
    };

    ConcealedHandler.prototype.createInterface = function (diy, editor) {
        var bindings = new ui.Bindings(editor, diy);

        var title = this.layoutTitle2(diy, bindings, [0], FACE_FRONT);
        var stats = this.layoutConcealedStats(bindings, FACE_FRONT);
        stats.setTitle(string('AHLCG-BasicData') + ': ' + string('AHLCG-Front'));

        var general = new ui.Grid();
        general.editorTabScrolling = true;
        general.place(title, 'wrap, pushx, growx', stats, 'wrap, pushx, growx');
        general.addToEditor(editor, string('AHLCG-General'));

        this.layoutPortraits(
            diy,
            bindings,
            'Portrait',
            null,
            true,
            false,
            false
        )[0].addToEditor(editor, string('AHLCG-Portraits'));

        bindings.bind();
    };

    ConcealedHandler.prototype.createFrontPainter = function (diy, sheet) {
        this.boxes.Name = this.box(diy, sheet, 'Name');
        this.initBodyTags(diy, this.boxes.Name);
    };

    ConcealedHandler.prototype.createBackPainter = function () {};

    ConcealedHandler.prototype.paintFront = function (g, diy, sheet) {
        this.clearImage(g, sheet);
        this.paintPortrait(g, diy, sheet, 'Portrait');
        this.drawTemplate(g, sheet);
        this.draw2LineName(g, diy, sheet, this.boxes.Name);
    };

    ConcealedHandler.prototype.paintBack = function (g, diy, sheet) {
        this.clearImage(g, sheet);
        this.drawBackTemplate(g, sheet);
    };

    ConcealedHandler.prototype.onClear = function (diy) {
        this.setDefaults(diy);
    };

    ConcealedHandler.prototype.onRead = function (diy, ois) {
        var settings = diy.settings;
        this.attach(diy);
        this.readPortraits(diy, ois);

        if (diy.version < 9) settings.set('Skill5', 'None');
        if (diy.version < 12) {
            settings.set('BackTypeBack', 'Player');
        } else if (diy.version < 17) {
            // an earlier version saved the back type under an undefined suffix
            let misplaced = this.get('BackTypeundefined');
            if (misplaced) {
                settings.set('BackTypeBack', misplaced);
                settings.reset('BackTypeundefined');
            }
            if (this.get('BackTypeBack') == null)
                settings.set('BackTypeBack', 'Player');
        }
        if (diy.version < 15) {
            settings.set('CardClass2', 'None');
            settings.set('CardClass3', 'None');
            settings.set('TemplateReplacement', '');
            settings.set('TemplateReplacementBack', '');
        }
        if (diy.version < 18 && this.get('Copyright') == null)
            settings.set('Copyright', '');
        if (diy.version < 16) diy.faceStyle = FaceStyle.TWO_FACES;

        this.updateCollection(diy);

        diy.setCornerRadius(8);
        diy.version = LegacyHandler.CARD_VERSION;
    };

    exportHandler(globalThis, new ConcealedHandler());
});

// Running this script directly (Quickscript) creates a test editor for the
// component; saving and loading it won't work correctly.
if (String(sourcefile) === 'Quickscript') {
    useLibrary('diy');
    testDIYScript();
}
