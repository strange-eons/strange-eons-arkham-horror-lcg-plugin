// A campaign guide page of a size (Guide75, GuideA4 or GuideLetter): a title
// or plain page with two portraits, left and right columns of rules and a
// page number. upgradesEarly: whether saves from before version 6 (no
// portraits) and 16 (no line spacing) exist for this size.
//
// Module: returns GuideHandler( type, upgradesEarly ).
define([
    'legacy/LegacyHandler',
    'se/diy',
    'se/markup',
    'se/strings',
    'se/ui',
], function (LegacyHandler, diyLibrary, markup, strings, ui) {
    const FACE_FRONT = LegacyHandler.FACE_FRONT;
    const string = strings.string;
    const Defaults = {
        PageType: 'Empty',
        Page: '1',
        RulesLeft: '',
        RulesRight: '',
        PositionPortrait1: 'TopLeftSmall',
        PositionPortrait2: 'BottomLarge',
        LineSpacingLeft: '100',
        LineSpacingRight: '100',
    };

    function GuideHandler(type, upgradesEarly) {
        LegacyHandler.call(
            this,
            [type],
            [''],
            ['Portrait1-Front', 'Portrait2-Front']
        );
        this.upgradesEarly = upgradesEarly;
    }
    GuideHandler.prototype = Object.create(LegacyHandler.prototype);
    GuideHandler.prototype.constructor = GuideHandler;

    GuideHandler.prototype.create = function (diy) {
        this.attach(diy);
        diy.frontTemplateKey = this.key(FACE_FRONT, 'Default', '-template');
        diy.faceStyle = diyLibrary.FaceStyle.ONE_FACE;
        diy.name = '';

        this.setDefaults(diy);
        this.createPortraits(diy);

        diy.version = LegacyHandler.CARD_VERSION;
    };

    GuideHandler.prototype.setDefaults = function (diy) {
        for (let key in Defaults) diy.settings.set(key, Defaults[key]);
    };

    // a column's rules with a line spacing spinner
    GuideHandler.prototype.layoutColumn = function (bindings, side) {
        var spacing = new ui.spinner(10, 300, 1, 100);
        bindings.add('LineSpacing' + side, spacing, [0]);
        var tab = new ui.Grid();
        tab.editorTabScrolling = true;
        tab.place(
            this.layoutText(bindings, ['Rules'], side, FACE_FRONT),
            'wrap, pushx, growx',
            string('AHLCG-LineSpacing'),
            'align left, split',
            spacing,
            'align left',
            '%',
            'pushx, growx, wrap, align left'
        );
        return tab;
    };

    GuideHandler.prototype.createInterface = function (diy, editor) {
        var bindings = new ui.Bindings(editor, diy);

        // first, as the title panel listens to the portrait panels
        var portraits = this.layoutGuidePortraits(
            diy,
            bindings,
            'Portrait1',
            'Portrait2',
            true
        );
        var portraitTab = portraits.shift();

        var title = this.layoutTitleGuide(
            diy,
            bindings,
            [0],
            FACE_FRONT,
            portraits
        );
        var stats = this.layoutGuideStats(bindings, FACE_FRONT);
        stats.setTitle(string('AHLCG-BasicData'));
        var general = new ui.Grid();
        general.editorTabScrolling = true;
        general.place(title, 'wrap, pushx, growx', stats, 'wrap, pushx, growx');
        general.addToEditor(editor, string('AHLCG-General'));

        portraitTab.addToEditor(editor, string('AHLCG-Portraits'));

        ['Left', 'Right'].forEach(function (side) {
            this.layoutColumn(bindings, side).addToEditor(
                editor,
                string('AHLCG-Rules') + ': ' + string('AHLCG-' + side)
            );
        }, this);

        bindings.bind();
    };

    GuideHandler.prototype.createFrontPainter = function (diy, sheet) {
        var b = this.boxes;
        b.Name = this.box(diy, sheet, 'Name');
        this.initBodyTags(diy, b.Name);
        b.Header = this.box(diy, sheet, 'ResHeader', 'Header');
        b.Label = this.box(diy, sheet, 'Label');
        b.Body = this.box(diy, sheet, 'Body');
        b.Body.setTextFitting(markup.FIT_NONE);
        this.initBodyTags(diy, b.Body);
        this.initGuideTags(diy, b.Body);
        b.Page = this.box(diy, sheet, 'Page');

        this.setupGuidePortrait(diy, 0, this.get('PositionPortrait1'), false);
        this.setupGuidePortrait(diy, 1, this.get('PositionPortrait2'), false);
    };

    GuideHandler.prototype.createBackPainter = function () {};

    GuideHandler.prototype.paintFront = function (g, diy, sheet) {
        var b = this.boxes;
        var pageType = this.get('PageType');

        this.clearImage(g, sheet);
        this.drawGuideTemplate(g, diy, sheet, b.Label);
        if (pageType === 'Title') this.drawName(g, diy, sheet, b.Name);

        var regions = ['Left', 'Right'].map(function (side) {
            return diy.settings.getRegion(
                this.key(FACE_FRONT, 'Body' + side + pageType + '-region')
            );
        }, this);
        this.drawGuidePortraits(g, diy, sheet);
        regions = this.guideBodyRegions(diy, regions);

        if (pageType === 'Empty') this.drawPageNumber(g, diy, sheet, b.Page);

        ['Left', 'Right'].forEach(function (side, i) {
            this.drawGuideBody(
                g,
                diy,
                sheet,
                b.Body,
                b.Header,
                regions[i],
                this.get('Rules' + side),
                parseInt(this.get('LineSpacing' + side))
            );
        }, this);
    };

    GuideHandler.prototype.paintBack = function () {};

    GuideHandler.prototype.onClear = function (diy) {
        this.setDefaults(diy);
    };

    GuideHandler.prototype.onRead = function (diy, ois) {
        this.attach(diy);
        if (this.upgradesEarly && diy.version < 6) this.createPortraits(diy);
        else this.readPortraits(diy, ois);

        if (this.upgradesEarly && diy.version < 16) {
            diy.settings.set('LineSpacingLeft', '100');
            diy.settings.set('LineSpacingRight', '100');
        }

        diy.version = LegacyHandler.CARD_VERSION;
    };

    return GuideHandler;
});
