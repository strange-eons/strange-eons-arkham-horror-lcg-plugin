// Investigator: class art with the investigator's art faded into it, title
// with a unique symbol and subtitle, the four skills, health and sanity, and
// game text. A parallel class has light title and skills; a Story class
// investigator has neutral art and shows its encounter set.
//
// Module: returns InvestigatorFace.
define([
    'faces/CardFace',
    'faces/FaceUtils',
    'faces/PlayerCard',
    'faces/PortraitArt',
    'se/java',
    'se/strings',
    'se/ui',
], function (CardFace, FaceUtils, PlayerCard, PortraitArt, Java, strings, ui) {
    const ListItem = Java.type('ca.cgjennings.apps.arkham.diy.ListItem');
    const Skills = ['Willpower', 'Intellect', 'Combat', 'Agility'];

    function InvestigatorFace() {
        CardFace.call(this);
    }

    InvestigatorFace.prototype = Object.create(CardFace.prototype);
    InvestigatorFace.prototype.constructor = InvestigatorFace;
    InvestigatorFace.prototype.template = 'AHLCG-InvestigatorFace';
    InvestigatorFace.prototype.portraits = ['TransparentPortrait'];
    InvestigatorFace.prototype.hasSubtitle = true;
    InvestigatorFace.prototype.hasSkills = true;
    InvestigatorFace.prototype.parts = [
        'Traits',
        'Keywords',
        'Rules',
        'Flavor',
    ];

    // the faded art is painted through a stencil, without mirrored edges
    InvestigatorFace.prototype.mirrorsArtEdges = function (name) {
        return name !== 'TransparentPortrait';
    };

    function isParallel(className) {
        return className.indexOf('Parallel') >= 0;
    }

    InvestigatorFace.prototype.cardClass = function (diy, faceIndex) {
        return String(
            diy.settings.get('CardClass' + this.suffix(faceIndex), 'Guardian')
        );
    };

    InvestigatorFace.prototype.defaultValues = function (diy, faceIndex) {
        var values = {
            Unique: '1',
            CardClass: 'Guardian',
            Stamina: '7',
            Sanity: '7',
        };
        Skills.forEach(function (skill) {
            values[skill] = '3';
        });
        return values;
    };

    InvestigatorFace.prototype.createPanels = function (
        diy,
        bindings,
        faceIndex
    ) {
        var o = FaceUtils.plugin();
        var face = this;
        var panel = new ui.Grid();
        var cell = 'pushx, growx, sizegroup sp';

        function list(name, items) {
            var control = new ui.comboBox(items, null);
            face.bind(bindings, faceIndex, name, control);
            return control;
        }
        var classes = o.comboClassesI.slice();
        classes.push(
            new ListItem('Story', strings.string('AHLCG-Class-Story'))
        );
        function skill(name) {
            return strings.string('AHLCG-Skill-' + name);
        }

        panel.place(
            strings.string('AHLCG-Class'),
            'align right',
            list('CardClass', classes),
            cell,
            skill('Willpower'),
            'align right, gapx 10',
            list('Willpower', o.comboStat),
            'wrap, ' + cell,
            strings.string('AHLCG-Stamina'),
            'align right',
            list('Stamina', o.comboInvestigatorHealth),
            cell,
            skill('Intellect'),
            'align right, gapx 10',
            list('Intellect', o.comboStat),
            'wrap, ' + cell,
            strings.string('AHLCG-Sanity'),
            'align right',
            list('Sanity', o.comboInvestigatorHealth),
            cell,
            skill('Combat'),
            'align right, gapx 10',
            list('Combat', o.comboStat),
            'wrap, ' + cell,
            skill('Agility'),
            'align right, skip 2',
            list('Agility', o.comboStat),
            cell
        );
        return [{ panel: panel, title: strings.string('AHLCG-BasicData') }];
    };

    InvestigatorFace.prototype.createPainter = function (
        diy,
        sheet,
        faceIndex
    ) {
        var boxes = CardFace.prototype.createPainter.call(
            this,
            diy,
            sheet,
            faceIndex
        );
        var face = this;
        // parallel styles keep the plain alignment
        function parallel(name) {
            var box = face.createBox(diy, sheet, 'Parallel' + name);
            box.alignment = diy.settings.getTextAlignment(
                face.key(diy.settings, name + '-alignment')
            );
            return box;
        }
        boxes.parallelName = parallel('Name');
        FaceUtils.initBodyTags(diy, boxes.parallelName);
        boxes.parallelSubtitle = parallel('Subtitle');
        if (!this.hasSkills) return boxes;
        boxes.skills = Skills.map(function () {
            return face.createBox(diy, sheet, 'Skill');
        });
        boxes.parallelSkills = Skills.map(function () {
            return parallel('Skill');
        });
        return boxes;
    };

    InvestigatorFace.prototype.templateKey = function (diy, faceIndex) {
        return PlayerCard.templateKey(
            this,
            diy,
            faceIndex,
            PlayerCard.artInitial(this.cardClass(diy, faceIndex))
        );
    };

    // the subtitle region of the class
    InvestigatorFace.prototype.paintClassSubtitle = function (
        g,
        diy,
        box,
        className,
        subtitle
    ) {
        var region = diy.settings.getRegion(
            this.key(
                diy.settings,
                'SubtitleText' + PlayerCard.initial(className) + '-region'
            )
        );
        region.y += parseInt(FaceUtils.plugin().subtitleFontOffset);
        box.markupText = subtitle;
        box.drawAsSingleLine(g, region);
    };

    InvestigatorFace.prototype.paint = function (
        g,
        diy,
        sheet,
        boxes,
        collector,
        art
    ) {
        var faceIndex = sheet.getSheetIndex();
        this.readSubtype(diy, faceIndex);
        this.clearSheet(g, sheet);
        this.replaced = this.paintTemplateImage(
            g,
            sheet,
            this.templateKey(diy, faceIndex)
        );
        FaceUtils.translateToTrim(g, sheet);
        this.paintContent(g, diy, sheet, boxes, collector, art);
    };

    InvestigatorFace.prototype.paintContent = function (
        g,
        diy,
        sheet,
        boxes,
        collector,
        art
    ) {
        var faceIndex = sheet.getSheetIndex();
        var suffix = this.suffix(faceIndex);
        var className = this.cardClass(diy, faceIndex);
        var parallel = isParallel(className);
        var story = className === 'Story';

        if (story && !this.replaced)
            this.paintImage(
                g,
                diy,
                sheet,
                'overlays/AHLCG-Asset-EncounterSetOverlay.png',
                'Encounter-overlay'
            );
        PortraitArt.paintFaded(
            g,
            diy,
            sheet,
            art.TransparentPortrait,
            'Investigator'
        );

        this.paintName(
            g,
            diy,
            sheet,
            parallel ? boxes.parallelName : boxes.name
        );
        var subtitle = this.getSubtitle(diy, faceIndex);
        if (subtitle.length > 0)
            this.paintClassSubtitle(
                g,
                diy,
                parallel ? boxes.parallelSubtitle : boxes.subtitle,
                className,
                subtitle
            );

        var skillBoxes = parallel ? boxes.parallelSkills : boxes.skills;
        Skills.forEach(function (skill, i) {
            skillBoxes[i].markupText = String(
                diy.settings.get(skill + suffix, '')
            );
            skillBoxes[i].drawAsSingleLine(
                g,
                diy.settings.getRegion(
                    this.key(diy.settings, skill + '-region')
                )
            );
        }, this);

        PlayerCard.paintStat(this, g, diy, sheet, suffix, 'Stamina');
        PlayerCard.paintStat(this, g, diy, sheet, suffix, 'Sanity');
        this.paintBody(g, diy, boxes.body, suffix);
        this.paintCollector(g, diy, sheet, boxes, collector, story, story);
    };

    // only a Story class investigator draws its encounter set
    InvestigatorFace.prototype.showsEncounterTab = function (diy, faceIndex) {
        return this.cardClass(diy, faceIndex) === 'Story';
    };

    return InvestigatorFace;
});
