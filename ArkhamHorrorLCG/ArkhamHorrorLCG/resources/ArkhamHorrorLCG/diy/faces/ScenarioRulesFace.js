// Scenario rules page: title, rules text and page number. A resolution page
// shows a fixed header in place of the title.
//
// Module: returns ScenarioRulesFace.
define([
    'faces/Face',
    'faces/FaceUtils',
    'se/markup',
    'se/strings',
    'se/ui',
    'se/java',
], function (Face, FaceUtils, markup, strings, ui, Java) {
    const BasicStroke = Java.type('java.awt.BasicStroke');
    const Color = Java.type('java.awt.Color');
    function ScenarioRulesFace() {
        Face.call(this);
    }

    ScenarioRulesFace.prototype = Object.create(Face.prototype);
    ScenarioRulesFace.prototype.constructor = ScenarioRulesFace;
    ScenarioRulesFace.prototype.template = 'AHLCG-ScenarioRulesFace';

    ScenarioRulesFace.prototype.setDefaults = function (diy, faceIndex, keep) {
        var values = {
            Page: String(faceIndex + 1),
            Resolution: '0',
            Rules: '',
        };
        // the front's title is the component name
        if (faceIndex !== 0) values.Title = '';
        this.setValues(diy, faceIndex, keep, values);
    };

    ScenarioRulesFace.prototype.createInterface = function (
        diy,
        bindings,
        faceIndex
    ) {
        var titlePanel = this.createTitlePanel(diy, bindings, faceIndex);
        var resolutionBox = new ui.checkBox(
            strings.string('AHLCG-ScenarioRules-Resolution')
        );
        this.bind(bindings, faceIndex, 'Resolution', resolutionBox);
        titlePanel.place(resolutionBox, 'skip 1, wrap');

        var statPanel = new ui.Grid();
        var pageSpinner = new ui.spinner(0, 50, 1, 1);
        this.bind(bindings, faceIndex, 'Page', pageSpinner);
        statPanel.place(
            strings.string('AHLCG-Page'),
            'align right, gapx 10',
            pageSpinner,
            'wrap'
        );

        var textPanel = FaceUtils.createTextPanel(
            this,
            bindings,
            faceIndex,
            ['Rules'],
            '',
            18
        );

        return {
            general: [
                { panel: titlePanel, title: strings.string('AHLCG-Title') },
                { panel: statPanel, title: strings.string('AHLCG-BasicData') },
            ],
            tabs: [{ panel: textPanel, title: strings.string('AHLCG-Rules') }],
        };
    };

    ScenarioRulesFace.prototype.createPainter = function (
        diy,
        sheet,
        faceIndex
    ) {
        var boxes = {
            name: this.createBox(diy, sheet, 'Name'),
            header: this.createBox(diy, sheet, 'Header'),
            page: this.createBox(diy, sheet, 'Page'),
            body: this.createBox(diy, sheet, 'Body'),
        };
        boxes.name.setLineTightness(
            Number(diy.settings.get(this.key(diy.settings, 'Name-tightness')))
        );
        FaceUtils.initBodyTags(diy, boxes.name, this);
        FaceUtils.initBodyTags(diy, boxes.body, this);
        return boxes;
    };

    ScenarioRulesFace.prototype.paint = function (g, diy, sheet, boxes) {
        var faceIndex = sheet.getSheetIndex();
        var suffix = this.suffix(faceIndex);
        var title = this.getTitle(diy, faceIndex);

        this.paintTemplate(g, sheet);
        FaceUtils.translateToTrim(g, sheet);

        var resolution =
            String(diy.settings.get('Resolution' + suffix, '0')) === '1';
        var bodyRegion = resolution
            ? 'BodyResolution-region'
            : title.length > 0
              ? 'BodyName-region'
              : 'Body-region';

        if (!resolution) this.paintTitle(g, diy, boxes.name, title);
        this.paintPage(
            g,
            diy,
            boxes.page,
            String(diy.settings.get('Page' + suffix, ''))
        );
        if (resolution) this.paintResolutionHeader(g, diy, boxes.header);
        this.paintRules(
            g,
            diy,
            boxes.body,
            String(diy.settings.get('Rules' + suffix, '')),
            bodyRegion
        );
    };

    // two header lines over a double rule as wide as the wider line
    ScenarioRulesFace.prototype.paintResolutionHeader = function (g, diy, box) {
        var region = diy.settings.getRegion(
            this.key(diy.settings, 'Header-region')
        );
        region.y += parseInt(FaceUtils.plugin().victoryFontOffset);

        box.markupText = strings.gstring('AHLCG-Scenario-Header1');
        var height = box.measure(g, region);
        var width1 = box.drawAsSingleLine(g, region) + 4.0;

        region.y += height;

        box.markupText =
            '<size 80%>' +
            strings.gstring('AHLCG-Scenario-Header2') +
            '<size 125%>';
        height = box.measure(g, region);
        var width2 = box.drawAsSingleLine(g, region) + 4.0;

        var width = Math.max(width1, width2);
        var left = region.x + (region.width - width) / 2;
        var right = region.x + (region.width + width) / 2;
        var y = region.y + height;

        g.setPaint(Color.BLACK);
        g.setStroke(new BasicStroke(1.0));
        g.drawLine(left, y, right, y);
        g.drawLine(left, y + 4, right, y + 4);
    };

    ScenarioRulesFace.prototype.paintPage = function (g, diy, box, page) {
        var parity = Number(page) % 2 === 0 ? 'PageEven' : 'PageOdd';
        box.markupText = page;
        box.drawAsSingleLine(
            g,
            diy.settings.getRegion(this.key(diy.settings, parity + '-region'))
        );
    };

    ScenarioRulesFace.prototype.paintRules = function (
        g,
        diy,
        box,
        rules,
        regionName
    ) {
        var settings = diy.settings;
        var o = FaceUtils.plugin();

        box.setLineTightness(
            Number(settings.get(this.key(settings, 'Body-tightness'))) *
                o.bodyFontTightness
        );
        box.setTextFitting(markup.FIT_SCALE_TEXT);
        box.setReplacementForTag('fullnameb', settings.get('TitleBack'));

        var region = settings.getRegion(this.key(settings, regionName));
        region.y += parseInt(o.bodyFontOffset);

        box.markupText = rules;
        markup.updateNameTags(box, diy);
        box.draw(g, region);
    };

    return ScenarioRulesFace;
});
