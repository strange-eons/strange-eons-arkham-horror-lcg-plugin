// A box or pack cover: one side with its art, the tinted
// AHLCG-<type>Tintable.png template part, the frame and the title. A box
// cover adds a second, bottom portrait.
//
// Module: returns CoverHandler( type, bottomPortrait ).
define([
    'legacy/LegacyHandler',
    'se/common',
    'se/diy',
    'se/imageutils',
    'se/strings',
    'se/ui',
], function (LegacyHandler, common, diyLibrary, imageutils, strings, ui) {
    const FACE_FRONT = LegacyHandler.FACE_FRONT;
    const string = strings.string;

    function CoverHandler(type, bottomPortrait) {
        LegacyHandler.call(
            this,
            [type],
            [''],
            bottomPortrait
                ? ['Portrait-Front', 'PortraitBottom-Front']
                : ['Portrait-Front']
        );
        this.type = type;
        this.bottomPortrait = bottomPortrait;
    }
    CoverHandler.prototype = Object.create(LegacyHandler.prototype);
    CoverHandler.prototype.constructor = CoverHandler;

    CoverHandler.prototype.create = function (diy) {
        this.attach(diy);
        diy.frontTemplateKey = this.key(FACE_FRONT, 'Default', '-template');
        diy.faceStyle = diyLibrary.FaceStyle.ONE_FACE;
        diy.name = '';

        this.setDefaults(diy);
        this.createPortraits(diy);

        diy.version = LegacyHandler.CARD_VERSION;
    };

    CoverHandler.prototype.setDefaults = function (diy) {
        diy.settings.set('tint', '0,1,1');
    };

    CoverHandler.prototype.createInterface = function (diy, editor) {
        var bindings = new ui.Bindings(editor, diy);

        var portraits = this.layoutPortraits(
            diy,
            bindings,
            'Portrait',
            null,
            true,
            false,
            false
        )[0];
        var bottom = this.bottomPortrait
            ? this.layoutPortraits(
                  diy,
                  bindings,
                  'PortraitBottom',
                  null,
                  true,
                  false,
                  false
              )[0]
            : null;

        this.layoutTint(bindings).addToEditor(editor, 'Tint');

        var title = this.layoutTitle2(diy, bindings, [0], FACE_FRONT);
        title.setTitle(string('AHLCG-Title') + ': ' + string('AHLCG-Front'));
        var general = new ui.Grid();
        general.editorTabScrolling = true;
        general.place(title, 'wrap, pushx, growx');
        general.addToEditor(editor, string('AHLCG-General'));

        portraits.addToEditor(editor, string('AHLCG-Portraits'));
        if (bottom != null) bottom.addToEditor(editor, 'Bottom Portrait');

        bindings.bind();
    };

    CoverHandler.prototype.createFrontPainter = function (diy, sheet) {
        this.boxes.Name = this.box(diy, sheet, 'Name');
        this.initBodyTags(diy, this.boxes.Name);
    };

    CoverHandler.prototype.paintFront = function (g, diy, sheet) {
        var ImageUtils = imageutils.ImageUtils;
        this.clearImage(g, sheet);
        this.portraits.forEach(function (portrait) {
            portrait.paint(g, sheet.getRenderTarget());
        });
        sheet.paintImage(
            g,
            ImageUtils.tint(
                ImageUtils.get(
                    'ArkhamHorrorLCG/templates/AHLCG-' +
                        this.type +
                        'Tintable.png'
                ),
                common.Settings.tint(diy.settings.get('tint'))
            ),
            diy.settings.getRegion('AHLCG-' + this.type + '-Tint-region')
        );
        this.drawBackTemplate(g, sheet, '');
        this.drawName(g, diy, sheet, this.boxes.Name);
    };

    CoverHandler.prototype.onClear = function (diy) {
        this.setDefaults(diy);
    };

    CoverHandler.prototype.onRead = function (diy, ois) {
        this.attach(diy);
        this.readPortraits(diy, ois);
        diy.version = LegacyHandler.CARD_VERSION;
    };

    return CoverHandler;
});
