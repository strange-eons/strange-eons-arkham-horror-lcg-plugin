// Customizable upgrade sheet: title, a header and eight options, each with
// its cost in boxes and its name, and the copyright.
//
// Settings, as legacy cards save them: CustHeader<suffix>, and for option n
// CustCost<n>, CustName<n>, CustText<n><suffix>, with
// <text key>Spacing. An option without a cost of its own takes the one
// before it.
//
// Module: returns CustomizableFace.
define([
    'faces/CollectorInfo',
    'faces/Face',
    'faces/FaceUtils',
    'se/markup',
    'se/strings',
    'se/ui',
], function (CollectorInfo, Face, FaceUtils, markup, strings, ui) {
    const Options = 8;
    const Spacer = '<image res://ArkhamHorrorLCG/images/empty1x1.png 1pt ';

    function CustomizableFace() {
        Face.call(this);
    }

    CustomizableFace.prototype = Object.create(Face.prototype);
    CustomizableFace.prototype.constructor = CustomizableFace;
    CustomizableFace.prototype.template = 'AHLCG-CustomizableFace';
    CustomizableFace.prototype.usesCopyright = true;
    CustomizableFace.prototype.usesTemplateReplacement = true;

    CustomizableFace.prototype.setDefaults = function (diy, faceIndex, keep) {
        var suffix = this.suffix(faceIndex);
        var values = { ScaleModifier: '100' };
        values['CustHeader' + suffix] = '';
        values['CustHeader' + suffix + 'Spacing'] = '0';
        for (let n = 1; n <= Options; n++) {
            values['CustCost' + n] = n === 1 ? '1' : '2';
            values['CustName' + n] = '';
            values['CustText' + n + suffix] = '';
            values['CustText' + n + suffix + 'Spacing'] = '0';
        }
        // the front's title is the component name
        if (faceIndex !== 0) values['Title' + suffix] = '';
        this.setSettings(diy, keep, values);
    };

    CustomizableFace.prototype.createInterface = function (
        diy,
        bindings,
        faceIndex
    ) {
        var face = this;
        var suffix = this.suffix(faceIndex);
        var o = FaceUtils.plugin();
        var tab = new ui.Grid();

        function bind(key, control) {
            face.bindKey(bindings, faceIndex, key, control);
            return control;
        }
        function textPanel(title, textKey, costIndex) {
            var panel = new ui.Grid();
            panel.setTitle(title);
            if (costIndex != null) {
                panel.place(
                    strings.string('AHLCG-Cost'),
                    'align right',
                    bind(
                        'CustCost' + costIndex,
                        new ui.comboBox(o.comboCustCost, null)
                    ),
                    'split 2',
                    bind('CustName' + costIndex, new ui.textField('', 26)),
                    'wrap, pushx, growx'
                );
            }
            var area = new ui.textArea('', 5, 26);
            panel.place(
                strings.string('AHLCG-Rules'),
                'aligny top, gaptop 5, align right',
                bind(textKey, area),
                'wrap, pushx, growx, ' + FaceUtils.textAreaWidth(area),
                strings.string('AHLCG-Spacing'),
                'align right',
                bind(textKey + 'Spacing', new ui.spinner(0, 300, 1, 1)),
                'wrap'
            );
            return panel;
        }

        tab.place(
            textPanel(
                strings.string('AHLCG-Rules') +
                    ' (' +
                    strings.string('AHLCG-Header') +
                    ')',
                'CustHeader' + suffix,
                null
            ),
            'wrap, pushx, growx'
        );
        for (let n = 1; n <= Options; n++) {
            tab.place(
                textPanel(
                    strings.string('AHLCG-Rules') +
                        ' (' +
                        strings.string('AHLCG-Option') +
                        ' ' +
                        n +
                        ')',
                    'CustText' + n + suffix,
                    n
                ),
                'wrap, pushx, growx'
            );
        }
        var scale = new ui.spinner(50, 150, 1, 100);
        // one for the card, as legacy cards save it
        this.bindKey(bindings, faceIndex, 'ScaleModifier', scale);
        tab.place(
            strings.string('AHLCG-TextScale'),
            'align left, split',
            scale,
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
            tabs: [{ panel: tab, title: strings.string('AHLCG-Rules') }],
        };
    };

    CustomizableFace.prototype.createPainter = function (
        diy,
        sheet,
        faceIndex
    ) {
        var boxes = {
            label: this.createBox(diy, sheet, 'Label'),
            name: this.createBox(diy, sheet, 'Name'),
            body: this.createBox(diy, sheet, 'Body'),
            copyright: this.createBox(diy, sheet, 'Copyright'),
        };
        FaceUtils.initBodyTags(diy, boxes.name, this);
        FaceUtils.initBodyTags(diy, boxes.body, this);
        FaceUtils.initCopyrightTags(diy, boxes.copyright);
        return boxes;
    };

    // Each part with text on its own line, an option after its cost boxes
    // and name, each followed by its spacing.
    CustomizableFace.prototype.bodyMarkup = function (diy, suffix) {
        var settings = diy.settings;
        var arno = String(FaceUtils.plugin().bodyFamily) === 'Arno Pro';
        var box = arno ? '☐' : '⧠';
        var text = '';
        var cost = 1;

        function part(key, prefix) {
            var entry = String(settings.get(key, ''));
            if (entry !== '') {
                if (text !== '') text += '\n';
                text += prefix + entry;
            }
            var spacing = settings.get(key + 'Spacing');
            if (spacing == null) return;
            spacing = Number(spacing);
            if (entry !== '')
                text += '\n' + Spacer + (1.5 + Math.max(spacing, 0)) + 'pt>';
            else if (spacing > 0) text += Spacer + spacing + 'pt>';
        }

        part('CustHeader' + suffix, '');
        for (let n = 1; n <= Options; n++) {
            let saved = settings.get('CustCost' + n);
            if (saved != null && String(saved).length > 0)
                cost = parseInt(saved, 10);
            let boxes = '';
            for (let i = 0; i < cost; i++) boxes += box;
            part(
                'CustText' + n + suffix,
                '<left>' +
                    (arno ? '' : '<family>') +
                    boxes +
                    (arno ? '' : '</family>') +
                    ' <hdr>' +
                    settings.get('CustName' + n, '') +
                    '.</hdr> '
            );
        }
        return text;
    };

    CustomizableFace.prototype.paint = function (g, diy, sheet, boxes) {
        var o = FaceUtils.plugin();
        var settings = diy.settings;
        var faceIndex = sheet.getSheetIndex();

        this.paintTemplate(g, sheet);
        FaceUtils.translateToTrim(g, sheet);

        var label = settings.getRegion(this.key(settings, 'Label-region'));
        label.y += parseInt(o.typeFontOffset);
        boxes.label.markupText = String(
            strings.gstring('AHLCG-Label-Customizable')
        ).toUpperCase();
        boxes.label.drawAsSingleLine(g, label);

        var title = this.getTitle(diy, faceIndex);
        if (title.length > 0) {
            let region = settings.getRegion(this.key(settings, 'Name-region'));
            region.y += parseInt(o.titleFontOffset);
            title.split('\n').forEach(function (line) {
                boxes.name.markupText = line;
                boxes.name.drawAsSingleLine(g, region);
                region.y += 16;
                region.height -= 16;
            });
        }

        var body = settings.getRegion(this.key(settings, 'Body-region'));
        body.y += parseInt(o.bodyFontOffset);
        boxes.body.setReplacementForTag('fullnameb', settings.get('TitleBack'));
        boxes.body.setLineTightness(
            Number(settings.get(this.key(settings, 'Body-tightness'))) *
                o.bodyFontTightness
        );
        boxes.body.setTextFitting(markup.FIT_SCALE_TEXT);
        boxes.body.markupText = this.bodyMarkup(diy, this.suffix(faceIndex));
        markup.updateNameTags(boxes.body, diy);
        boxes.body.draw(g, body);

        CollectorInfo.paintCopyright(g, diy, sheet, this, boxes.copyright);
    };

    return CustomizableFace;
});
