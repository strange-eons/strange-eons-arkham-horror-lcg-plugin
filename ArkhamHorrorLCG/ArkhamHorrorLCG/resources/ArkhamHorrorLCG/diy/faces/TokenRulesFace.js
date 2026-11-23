// The chaos template: a title with an encounter icon frame over game text
// blocks, which can include intro text and chaos token blocks. A full page has
// no title or frame, and gives their space to the text.
//
// Module: returns TokenRulesFace.
define([
    'faces/FaceUtils',
    'faces/TextBlocks',
    'faces/TextBlocksFace',
    'se/markup',
    'se/strings',
    'se/ui',
    'se/java',
], function (FaceUtils, TextBlocks, TextBlocksFace, markup, strings, ui, Java) {
    const BasicStroke = Java.type('java.awt.BasicStroke');
    const Color = Java.type('java.awt.Color');
    const ListItem = Java.type('ca.cgjennings.apps.arkham.diy.ListItem');
    const Difficulties = ['None', 'Front', 'Back', 'Unique'];
    // space a difficulty line and a second title line take from the text
    const DifficultyHeight = 29;
    const SecondLineHeight = 21;
    // title line pitch, and the space below the last line, in title line heights
    const TitlePitch = 0.72;
    const TitleBelow = 0.8;

    function TokenRulesFace() {
        TextBlocksFace.call(this);
    }

    TokenRulesFace.prototype = Object.create(TextBlocksFace.prototype);
    TokenRulesFace.prototype.constructor = TokenRulesFace;
    TokenRulesFace.prototype.template = 'AHLCG-TokenRulesFace';
    TokenRulesFace.prototype.usesTemplateReplacement = true;
    TokenRulesFace.prototype.blockStyles = TextBlocks.Styles.concat([
        'intro',
        'token',
    ]);

    TokenRulesFace.prototype.setDefaults = function (diy, faceIndex, keep) {
        TextBlocksFace.prototype.setDefaults.call(this, diy, faceIndex, keep);
        this.setValues(diy, faceIndex, keep, {
            BlockTokens1: '',
            ChaosFull: '0',
            Difficulty: 'None',
            TemplateReplacement: '',
        });
    };

    TokenRulesFace.prototype.createTextOptions = function (
        bindings,
        faceIndex
    ) {
        var panel = new ui.Grid();
        var fullBox = new ui.checkBox(strings.string('AHLCG-FullPage'));
        this.bind(bindings, faceIndex, 'ChaosFull', fullBox);

        var items = Difficulties.map(function (id) {
            var label =
                id === 'None'
                    ? strings.string('AHLCG-Difficulty-None')
                    : strings.gstring('AHLCG-Difficulty-' + id);
            return new ListItem(id, label);
        });
        var difficultyList = new ui.comboBox(items, null);
        this.bind(bindings, faceIndex, 'Difficulty', difficultyList);

        panel.place(
            fullBox,
            'wrap',
            strings.string('AHLCG-Difficulty'),
            'split 2',
            difficultyList,
            'wrap'
        );
        return panel;
    };

    TokenRulesFace.prototype.createPainter = function (diy, sheet, faceIndex) {
        var boxes = TextBlocksFace.prototype.createPainter.call(
            this,
            diy,
            sheet,
            faceIndex
        );
        boxes.difficulty = this.createBox(diy, sheet, 'Difficulty');
        boxes.intro = this.createBox(diy, sheet, 'Intro');
        boxes.intro.setLineTightness(
            Number(
                diy.settings.get(this.key(diy.settings, 'Intro-tightness'))
            ) * FaceUtils.plugin().bodyFontTightness
        );
        boxes.intro.setTextFitting(markup.FIT_SCALE_TEXT);
        boxes.tokens = [];
        return boxes;
    };

    TokenRulesFace.prototype.createTokenBox = function (diy, sheet) {
        var box = this.createBox(diy, sheet, 'Token');
        box.setLineTightness(
            Number(
                diy.settings.get(this.key(diy.settings, 'Token-tightness'))
            ) * FaceUtils.plugin().bodyFontTightness
        );
        box.setTextFitting(markup.FIT_SCALE_TEXT);
        FaceUtils.initBodyTags(diy, box);
        return box;
    };

    TokenRulesFace.prototype.isFullPage = function (diy, faceIndex) {
        return (
            String(
                diy.settings.get('ChaosFull' + this.suffix(faceIndex), '0')
            ) === '1'
        );
    };

    TokenRulesFace.prototype.getDifficulty = function (diy, faceIndex) {
        return String(
            diy.settings.get('Difficulty' + this.suffix(faceIndex), 'None')
        );
    };

    TokenRulesFace.prototype.textRegion = function (diy, faceIndex, name) {
        if (this.isFullPage(diy, faceIndex))
            return TextBlocksFace.prototype.textRegion.call(
                this,
                diy,
                faceIndex,
                'Full' + name
            );

        var region = TextBlocksFace.prototype.textRegion.call(
            this,
            diy,
            faceIndex,
            name
        );
        if (name === 'Body' || name === 'Story') {
            let offset = 0;
            let title =
                this.paintedTitle != null
                    ? this.paintedTitle
                    : this.getTitle(diy, faceIndex);
            if (title.indexOf('\n') > 0) offset += SecondLineHeight;
            if (this.getDifficulty(diy, faceIndex) !== 'None')
                offset += DifficultyHeight;
            region.y += offset;
            region.height -= offset;
        }
        return region;
    };

    TokenRulesFace.prototype.paint = function (
        g,
        diy,
        sheet,
        boxes,
        collector
    ) {
        var faceIndex = sheet.getSheetIndex();
        var full = this.isFullPage(diy, faceIndex);

        var replaced = this.paintTemplate(g, sheet);
        if (!full && !replaced)
            sheet.paintImage(g, this.template + '-EncounterFrame');
        FaceUtils.translateToTrim(g, sheet);

        var top;
        if (full) top = this.textRegion(diy, faceIndex, 'Token').y;
        else {
            top = diy.settings.getRegion(
                this.key(diy.settings, 'Difficulty-region')
            ).y;
            let title = this.getTitle(diy, faceIndex);
            if (title.length > 0) {
                title = this.wrapTitle(g, diy, boxes.name, title);
                this.paintedTitle = title;
                top = this.paintChaosTitle(g, diy, boxes.name, title);
            }
            top = this.paintDifficulty(
                g,
                diy,
                boxes.difficulty,
                this.getDifficulty(diy, faceIndex),
                top
            );
        }

        this.paintText(g, diy, sheet, boxes, top);
        this.paintedTitle = null;
        this.paintCollector(g, diy, sheet, boxes, collector, !full);
    };

    // A one line title too wide for <Name-region> as two lines, broken at the
    // space outside markup tags that leaves the longer line shortest.
    TokenRulesFace.prototype.wrapTitle = function (g, diy, box, title) {
        if (title.indexOf('\n') >= 0) return title;
        var region = diy.settings.getRegion(
            this.key(diy.settings, 'Name-region')
        );
        function height(text) {
            box.markupText = text;
            return box.measure(g, region);
        }
        var lineHeight = height('Size');
        var oneLine = lineHeight * 1.5;
        if (height(title) <= oneLine) return title;

        var spaces = [];
        var depth = 0;
        for (let i = 0; i < title.length; i++) {
            let c = title.charAt(i);
            if (c === '<') depth++;
            else if (c === '>') depth = Math.max(0, depth - 1);
            else if (c === ' ' && depth === 0) spaces.push(i);
        }
        if (spaces.length === 0) return title;
        // nearest the middle first
        spaces.sort(function (a, b) {
            return (
                Math.abs(a - title.length / 2) - Math.abs(b - title.length / 2)
            );
        });
        var split = function (i) {
            return title.slice(0, i) + '\n' + title.slice(i + 1);
        };
        for (let n = 0; n < spaces.length; n++) {
            let i = spaces[n];
            if (
                height(title.slice(0, i)) <= oneLine &&
                height(title.slice(i + 1)) <= oneLine
            )
                return split(i);
        }
        return split(spaces[0]);
    };

    // Each line of the title above a double rule as wide as the last line.
    // Returns the bottom of the rule.
    TokenRulesFace.prototype.paintChaosTitle = function (g, diy, box, title) {
        var region = diy.settings.getRegion(
            this.key(diy.settings, 'Name-region')
        );
        region.y += parseInt(FaceUtils.plugin().titleFontOffset);

        box.markupText = 'Size';
        var lineHeight = box.measure(g, region);

        var width = 0;
        var advance = function (dy) {
            region.y += dy;
            region.height -= dy;
        };
        title.split('\n').forEach(function (line, i) {
            if (i > 0) advance(lineHeight * TitlePitch);
            box.markupText = line;
            width = box.drawAsSingleLine(g, region);
        });
        advance(lineHeight * TitleBelow);

        g.setPaint(Color.BLACK);
        g.setStroke(new BasicStroke(1.0));
        g.drawLine(
            region.x + (region.width - width) / 2,
            region.y + 2,
            region.x + (region.width + width) / 2 + 2,
            region.y + 2
        );
        g.drawLine(
            region.x + (region.width - width) / 2,
            region.y + 6,
            region.x + (region.width + width) / 2 + 2,
            region.y + 6
        );

        return region.y + 12;
    };

    // returns where the next block starts
    TokenRulesFace.prototype.paintDifficulty = function (
        g,
        diy,
        box,
        difficulty,
        y
    ) {
        if (difficulty === 'None') return y;

        var region = diy.settings.getRegion(
            this.key(diy.settings, 'Difficulty-region')
        );
        region.y = y + parseInt(FaceUtils.plugin().typeFontOffset);
        box.markupText = strings.gstring('AHLCG-Difficulty-' + difficulty);
        box.drawAsSingleLine(g, region);
        return y + DifficultyHeight;
    };

    return TokenRulesFace;
});
