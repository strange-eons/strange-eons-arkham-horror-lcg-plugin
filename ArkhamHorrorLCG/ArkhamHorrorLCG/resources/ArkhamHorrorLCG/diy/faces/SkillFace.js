// Player skill: class art, title, level, up to six skill icons and game text
// in the skill's outline. A Weakness, BasicWeakness or StoryWeakness class
// card is a weakness skill; a Story or StoryWeakness one shows its encounter
// set, a story weakness's in place of the level.
//
// Module: returns SkillFace.
define([
    'faces/CardFace',
    'faces/FaceUtils',
    'faces/PlayerCard',
    'se/strings',
    'se/ui',
], function (CardFace, FaceUtils, PlayerCard, strings, ui) {
    const SkillCount = 6;
    // the circle by the title's region, by class; a story weakness's is in
    // place of the level
    const Circles = {
        Story: 'Encounter-overlay',
        StoryWeakness: 'StoryWeaknessSkill',
        BasicWeakness: 'BasicWeaknessSkill',
    };

    function SkillFace() {
        CardFace.call(this);
    }

    SkillFace.prototype = Object.create(CardFace.prototype);
    SkillFace.prototype.constructor = SkillFace;
    SkillFace.prototype.template = 'AHLCG-SkillFace';
    SkillFace.prototype.labelKey = 'AHLCG-Label-Skill';

    SkillFace.prototype.defaultValues = function (diy, faceIndex) {
        var values = { CardClass: 'Guardian', Level: '0' };
        for (let i = 1; i <= SkillCount; i++) values['Skill' + i] = 'None';
        return values;
    };

    SkillFace.prototype.createPanels = function (diy, bindings, faceIndex) {
        var o = FaceUtils.plugin();
        var face = this;
        var panel = new ui.Grid();
        var cell = 'pushx, growx, sizegroup sp';

        function list(name, items) {
            var control = new ui.comboBox(items, null);
            face.bind(bindings, faceIndex, name, control);
            return control;
        }

        panel.place(
            strings.string('AHLCG-Class'),
            'align right',
            list('CardClass', o.comboClassesBWS),
            cell,
            strings.string('AHLCG-Level'),
            'align right, gapx 10',
            list('Level', o.comboLevelsN),
            'wrap, ' + cell
        );
        for (let i = 1; i <= SkillCount; i++) {
            panel.place(
                strings.string('AHLCG-Icon') + ' ' + i,
                'align right',
                list('Skill' + i, o.comboSkills),
                (i < SkillCount ? 'wrap, ' : '') + cell
            );
        }
        return [{ panel: panel, title: strings.string('AHLCG-BasicData') }];
    };

    // the outline is the plug-in's, from the plain body region
    SkillFace.prototype.bodyShape = function (region) {
        return FaceUtils.plugin().getSkillTextShape(region);
    };

    SkillFace.prototype.templateKey = function (diy, faceIndex) {
        var cardClass = String(
            diy.settings.get('CardClass' + this.suffix(faceIndex), '')
        );
        return PlayerCard.templateKey(
            this,
            diy,
            faceIndex,
            PlayerCard.artInitial(cardClass)
        );
    };

    // a story weakness's encounter icon is where the level would be
    SkillFace.prototype.readKeyVariant = PlayerCard.readKeyVariant;

    SkillFace.prototype.paintContent = function (
        g,
        diy,
        sheet,
        boxes,
        collector
    ) {
        var suffix = this.suffix(sheet.getSheetIndex());
        var cardClass = String(diy.settings.get('CardClass' + suffix, ''));
        var art = PlayerCard.artInitial(cardClass);
        var weakness = PlayerCard.isWeakness(cardClass);
        var storyWeakness = cardClass === 'StoryWeakness';

        this.paintLabel(g, diy, boxes.label);
        // the title sits a little higher on weakness art
        this.paintName(g, diy, sheet, boxes.name, art === 'W' ? 1 : 0);

        if (!weakness)
            PlayerCard.paintLevel(
                this,
                g,
                diy,
                sheet,
                art,
                String(diy.settings.get('Level' + suffix, '0')),
                true
            );
        else if (!storyWeakness)
            PlayerCard.paintWeaknessLevel(this, g, diy, sheet, true);
        PlayerCard.paintCircle(this, g, diy, sheet, cardClass, Circles);
        PlayerCard.paintWeaknessSubtype(this, g, diy, boxes.subtype, cardClass);

        PlayerCard.paintSkillIcons(
            this,
            g,
            diy,
            sheet,
            suffix,
            cardClass,
            SkillCount,
            true
        );
        this.paintBody(
            g,
            diy,
            boxes.body,
            suffix,
            weakness ? 'WeaknessBody' : 'Body'
        );

        var story = cardClass === 'Story' || storyWeakness;
        this.paintCollector(g, diy, sheet, boxes, collector, story, story);
    };

    // only a story card draws its encounter set
    SkillFace.prototype.showsEncounterTab = function (diy, faceIndex) {
        var cardClass = String(
            diy.settings.get('CardClass' + this.suffix(faceIndex), '')
        );
        return cardClass === 'Story' || cardClass === 'StoryWeakness';
    };

    return SkillFace;
});
