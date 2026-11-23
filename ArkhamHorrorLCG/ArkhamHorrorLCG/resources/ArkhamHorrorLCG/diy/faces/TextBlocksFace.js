// Base of faces whose game text is a list of blocks (faces/TextBlocks.js): a
// title, the blocks and an optional tracking box.
//
// Module: returns TextBlocksFace.
define([
    'faces/CollectorInfo',
    'faces/Face',
    'faces/FaceUtils',
    'faces/TextBlocks',
    'se/common',
    'se/imageutils',
    'se/strings',
    'se/ui',
], function (
    CollectorInfo,
    Face,
    FaceUtils,
    TextBlocks,
    common,
    imageutils,
    strings,
    ui
) {
    function TextBlocksFace() {
        Face.call(this);
    }

    TextBlocksFace.prototype = Object.create(Face.prototype);
    TextBlocksFace.prototype.constructor = TextBlocksFace;
    TextBlocksFace.prototype.usesCollection = true;
    TextBlocksFace.prototype.usesEncounter = true;
    TextBlocksFace.prototype.usesCopyright = true;
    // whether the face offers a tracking box
    TextBlocksFace.prototype.hasTracker = true;
    // the block styles offered in the editor
    TextBlocksFace.prototype.blockStyles = TextBlocks.Styles;

    TextBlocksFace.prototype.setDefaults = function (diy, faceIndex, keep) {
        var suffix = this.suffix(faceIndex);
        var values = TextBlocks.defaults(suffix);
        values['ScaleModifier' + suffix] = '100';
        if (this.hasTracker) {
            values['TrackerBox' + suffix] = '';
            values['TrackerHeight' + suffix] = '100';
        }
        // the front's title is the component name
        if (faceIndex !== 0) values['Title' + suffix] = '';

        this.setSettings(diy, keep, values);
    };

    // every block either side has, so both sides list them alike
    TextBlocksFace.prototype.extraSettings = function (diy, faceIndex) {
        var n = Math.max(
            TextBlocks.count(diy.settings, ''),
            TextBlocks.count(diy.settings, 'Back')
        );
        return TextBlocks.keys(this.suffix(faceIndex), n);
    };

    // a panel of face options for the top of the text tab, or null
    TextBlocksFace.prototype.createTextOptions = function (
        bindings,
        faceIndex
    ) {
        return null;
    };

    TextBlocksFace.prototype.createInterface = function (
        diy,
        bindings,
        faceIndex
    ) {
        var trackerPanel = new ui.Grid();
        trackerPanel.setTitle(strings.string('AHLCG-TrackerBox'));
        var trackerField = new ui.textField('', 30);
        var heightSpinner = new ui.spinner(50, 200, 1, 100);
        if (this.hasTracker) {
            this.bind(bindings, faceIndex, 'TrackerBox', trackerField);
            this.bind(bindings, faceIndex, 'TrackerHeight', heightSpinner);
        }
        trackerPanel.place(
            strings.string('AHLCG-TrackerBox'),
            'align right',
            trackerField,
            'wrap, pushx, growx',
            strings.string('AHLCG-Height'),
            'align right',
            heightSpinner,
            'align left, split',
            '%',
            'pushx, growx, align left'
        );

        var textTab = new ui.Grid();
        var options = this.createTextOptions(bindings, faceIndex);
        if (options != null) textTab.place(options, 'wrap, pushx, growx');
        textTab.place(
            TextBlocks.createPanel(diy, this, bindings, faceIndex),
            'wrap, pushx, growx'
        );
        if (this.hasTracker) textTab.place(trackerPanel, 'wrap, pushx, growx');

        var scaleSpinner = new ui.spinner(50, 150, 1, 100);
        this.bind(bindings, faceIndex, 'ScaleModifier', scaleSpinner);
        textTab.place(
            strings.string('AHLCG-TextScale'),
            'align left, split',
            scaleSpinner,
            'align left',
            '%',
            'wrap, align left'
        );

        return {
            general: [
                {
                    panel: this.createTitlePanel(diy, bindings, faceIndex),
                    title: strings.string('AHLCG-Title'),
                },
            ],
            tabs: [{ panel: textTab, title: strings.string('AHLCG-Rules') }],
        };
    };

    TextBlocksFace.prototype.createPainter = function (diy, sheet, faceIndex) {
        var boxes = {
            name: this.createBox(diy, sheet, 'Name'),
            traits: this.createBox(diy, sheet, 'Header'),
            header: this.createBox(diy, sheet, 'Header'),
            story: this.createBox(diy, sheet, 'Story'),
            body: this.createBox(diy, sheet, 'Body'),
            tracker: this.hasTracker
                ? this.createBox(diy, sheet, 'TrackerName')
                : null,
            collectionNumber: this.createBox(diy, sheet, 'CollectionNumber'),
            encounterNumber: this.createBox(diy, sheet, 'EncounterNumber'),
            copyright: this.createBox(diy, sheet, 'Copyright'),
        };
        FaceUtils.initBodyTags(diy, boxes.name, this);
        FaceUtils.initBodyTags(diy, boxes.traits, this);
        FaceUtils.initBodyTags(diy, boxes.header, this);
        FaceUtils.initBodyTags(diy, boxes.story, this);
        FaceUtils.initBodyTags(diy, boxes.body, this);
        FaceUtils.initCopyrightTags(diy, boxes.copyright);
        return boxes;
    };

    // the region for a kind of block
    TextBlocksFace.prototype.textRegion = function (diy, faceIndex, name) {
        return diy.settings.getRegion(this.key(diy.settings, name + '-region'));
    };

    // Paints the tracking box and the blocks. top: where intro and token
    // blocks start when they come first.
    TextBlocksFace.prototype.paintText = function (g, diy, sheet, boxes, top) {
        var faceIndex = sheet.getSheetIndex();
        var suffix = this.suffix(faceIndex);

        var tracker = String(diy.settings.get('TrackerBox' + suffix, ''));
        var trackerHeight = Number(
            diy.settings.get('TrackerHeight' + suffix, '100')
        );
        if (tracker.length > 0)
            this.paintTracker(
                g,
                diy,
                sheet,
                boxes.tracker,
                tracker,
                trackerHeight
            );

        var scaleModifier = Number(
            diy.settings.get('ScaleModifier' + suffix, '100')
        );
        TextBlocks.paint(
            g,
            diy,
            sheet,
            this,
            boxes,
            TextBlocks.read(diy.settings, suffix, this.blockStyles),
            scaleModifier,
            {
                top: top,
                trackerHeight: tracker.length > 0 ? trackerHeight : 0,
            }
        );
    };

    TextBlocksFace.prototype.paintCollector = function (
        g,
        diy,
        sheet,
        boxes,
        collector,
        encounterIcon
    ) {
        CollectorInfo.paint(
            g,
            diy,
            sheet,
            this,
            boxes,
            collector,
            encounterIcon
        );
    };

    // a box image stretched to the tracker height (percent), aligned to the
    // bottom of <TrackerBox-region>, with the name at its top
    TextBlocksFace.prototype.paintTracker = function (
        g,
        diy,
        sheet,
        box,
        name,
        height
    ) {
        var ImageUtils = imageutils.ImageUtils;
        var Region = common.Region;

        var region = diy.settings.getRegion(
            this.key(diy.settings, 'TrackerBox-region')
        );
        var nameRegion = diy.settings.getRegion(
            this.key(diy.settings, 'TrackerName-region')
        );
        nameRegion.y += parseInt(FaceUtils.plugin().titleFontOffset);

        var diff = (region.height * (100.0 - height)) / 100.0;
        region.y += diff;
        region.height -= diff;
        nameRegion.y += diff;

        var boxImage = ImageUtils.get(
            'ArkhamHorrorLCG/overlays/AHLCG-BoxTracker.png'
        );
        var lineImage = ImageUtils.get(
            'ArkhamHorrorLCG/overlays/AHLCG-BoxTrackerLine.png'
        );
        var w = boxImage.getWidth();
        var h = boxImage.getHeight();

        // top, stretched middle and bottom (the top flipped)
        sheet.paintImage(g, boxImage, new Region(region.x, region.y, w, h));
        sheet.paintImage(
            g,
            lineImage,
            new Region(region.x, region.y + h, w, region.height - h * 2)
        );
        sheet.paintImage(
            g,
            ImageUtils.mirror(boxImage, false, true),
            new Region(region.x, region.y + region.height - h, w, h)
        );

        box.markupText = name;
        box.drawAsSingleLine(g, nameRegion);
    };

    return TextBlocksFace;
});
