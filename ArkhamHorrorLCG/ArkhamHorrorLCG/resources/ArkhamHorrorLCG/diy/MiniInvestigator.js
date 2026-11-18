/* global useLibrary, sourcefile, testDIYScript, globalThis */
useLibrary('amd');

if (String(sourcefile) === 'Quickscript') {
    define.config({
        baseUrl: 'project:ArkhamHorrorLCG/resources/ArkhamHorrorLCG/diy',
    });
}

// A mini investigator card: the portrait in colour on the front and in
// greyscale on the back.
define([
    'handlers/exportHandler',
    'legacy/LegacyHandler',
    'se/diy',
    'se/java',
    'se/strings',
    'se/ui',
], function (exportHandler, LegacyHandler, diyLibrary, java, strings, ui) {
    const FACE_FRONT = LegacyHandler.FACE_FRONT;
    const FACE_BACK = LegacyHandler.FACE_BACK;
    const AffineTransform = java.type('java.awt.geom.AffineTransform');

    function MiniInvestigatorHandler() {
        LegacyHandler.call(
            this,
            ['MiniInvestigator', 'MiniInvestigator'],
            ['', 'Back'],
            ['Portrait-Both']
        );
    }
    MiniInvestigatorHandler.prototype = Object.create(LegacyHandler.prototype);
    MiniInvestigatorHandler.prototype.constructor = MiniInvestigatorHandler;

    MiniInvestigatorHandler.prototype.create = function (diy) {
        this.attach(diy);
        diy.frontTemplateKey = this.key(FACE_FRONT, 'Default', '-template');
        diy.backTemplateKey = this.key(FACE_BACK, 'Default', '-template');
        diy.faceStyle = diyLibrary.FaceStyle.TWO_FACES;
        diy.name = '';

        this.createPortraits(diy);

        diy.setCornerRadius(8);
        diy.version = LegacyHandler.CARD_VERSION;
    };

    MiniInvestigatorHandler.prototype.createInterface = function (
        diy,
        editor
    ) {
        var bindings = new ui.Bindings(editor, diy);
        this.layoutPortraits(
            diy,
            bindings,
            'Portrait',
            null,
            true,
            false,
            false
        )[0].addToEditor(editor, strings.string('AHLCG-Portraits'));
        bindings.bind();
    };

    MiniInvestigatorHandler.prototype.createFrontPainter = function (
        diy,
        sheet
    ) {
        this.boxes.Artist = this.box(diy, sheet, 'Artist');
    };

    MiniInvestigatorHandler.prototype.createBackPainter = function () {};

    MiniInvestigatorHandler.prototype.paintFront = function (g, diy, sheet) {
        this.clearImage(g, sheet);
        this.drawTemplate(g, sheet);
        this.paintPortrait(g, diy, sheet, 'Portrait');
        this.drawArtist(g, diy, sheet, this.boxes.Artist, false);
    };

    // the portrait in greyscale, placed as on the front
    MiniInvestigatorHandler.prototype.paintBack = function (g, diy, sheet) {
        this.clearImage(g, sheet);
        this.drawTemplate(g, sheet);

        var portrait = this.portraits[this.portraitIndex('Portrait')];
        var image = this.greyscale(portrait.getImage());
        var scale = portrait.getScale();
        var region = diy.settings.getRegion(
            this.key(FACE_FRONT, 'Portrait-portrait-clip-region')
        );
        var transform = AffineTransform.getTranslateInstance(
            region.x +
                region.width / 2 +
                portrait.getPanX() -
                (image.width * scale) / 2,
            region.y +
                region.height / 2 +
                portrait.getPanY() -
                (image.height * scale) / 2
        );
        transform.concatenate(AffineTransform.getScaleInstance(scale, scale));
        transform.concatenate(
            AffineTransform.getRotateInstance(
                (-portrait.getRotation() * Math.PI) / 180,
                image.width / 2,
                image.height / 2
            )
        );
        g.drawImage(image, transform, null);
    };

    MiniInvestigatorHandler.prototype.onClear = function () {};

    MiniInvestigatorHandler.prototype.onRead = function (diy, ois) {
        this.attach(diy);
        this.readPortraits(diy, ois);
        diy.setCornerRadius(8);
        diy.version = LegacyHandler.CARD_VERSION;
    };

    exportHandler(globalThis, new MiniInvestigatorHandler());
});

// Running this script directly (Quickscript) creates a test editor for the
// component; saving and loading it won't work correctly.
if (String(sourcefile) === 'Quickscript') {
    useLibrary('diy');
    testDIYScript();
}
