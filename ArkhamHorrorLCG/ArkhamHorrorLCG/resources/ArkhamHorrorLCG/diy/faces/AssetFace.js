// Player asset: class art, or dual and triple class art with class symbols,
// title and subtitle, cost, level, skill icons, slots, health and sanity. A
// Weakness or BasicWeakness class card is a weakness asset. A Story or
// StoryWeakness class card is a story asset: neutral or weakness art with an
// empty level circle and the encounter set's circle, or a weakness's
// overlay, and the encounter set.
//
// Module: returns AssetFace.
define([
    'faces/CardFace',
    'faces/FaceUtils',
    'faces/PlayerCard',
    'se/common',
    'se/imageutils',
    'se/java',
    'se/strings',
    'se/ui',
], function (
    CardFace,
    FaceUtils,
    PlayerCard,
    common,
    imageutils,
    Java,
    strings,
    ui
) {
    const ListItem = Java.type('ca.cgjennings.apps.arkham.diy.ListItem');
    const SkillCount = 5;

    // the circle by the title's region, by class
    const Circles = {
        Reward: 'Encounter-overlay',
        Story: 'Encounter-overlay',
        StoryWeakness: 'StoryWeakness-overlay',
        BasicWeakness: 'BasicWeaknessAsset',
    };

    function AssetFace() {
        CardFace.call(this);
    }

    AssetFace.prototype = Object.create(CardFace.prototype);
    AssetFace.prototype.constructor = AssetFace;
    AssetFace.prototype.template = 'AHLCG-AssetFace';
    AssetFace.prototype.labelKey = 'AHLCG-Label-Asset';
    AssetFace.prototype.hasSubtitle = true;
    AssetFace.prototype.anchorsVictory = true;

    function isStory(cardClass) {
        return ['Reward', 'Story', 'StoryWeakness'].includes(cardClass);
    }

    // the class the art is drawn for; story art is neutral or weakness art
    function artClass(diy, suffix) {
        var cardClass = String(diy.settings.get('CardClass' + suffix, ''));
        if (cardClass === 'Reward' || cardClass === 'Story') return 'Neutral';
        if (cardClass === 'StoryWeakness') return 'Weakness';
        return PlayerCard.artClass(diy, suffix);
    }

    // the player classes, then the story classes
    function classList(o) {
        return o.comboClassesBW.concat([
            new ListItem('Reward', strings.string('AHLCG-Class-Reward')),
            new ListItem('Story', strings.string('AHLCG-Class-Story')),
            new ListItem(
                'StoryWeakness',
                strings.string('AHLCG-Class-StoryWeakness')
            ),
        ]);
    }

    AssetFace.prototype.defaultValues = function (diy, faceIndex) {
        var values = {
            CardClass: 'Guardian',
            CardClass2: 'None',
            CardClass3: 'None',
            ResourceCost: '0',
            Level: '0',
            Slot: 'None',
            Slot2: 'None',
            Stamina: 'None',
            Sanity: 'None',
            PerInvestigatorStamina: '0',
            PerInvestigatorSanity: '0',
        };
        for (let i = 1; i <= SkillCount; i++) values['Skill' + i] = 'None';
        return values;
    };

    AssetFace.prototype.createPanels = function (diy, bindings, faceIndex) {
        var o = FaceUtils.plugin();
        var face = this;
        var panel = new ui.Grid();

        function control(name, created) {
            face.bind(bindings, faceIndex, name, created);
            return created;
        }
        function list(name, items) {
            return control(name, new ui.comboBox(items, null));
        }
        var row = 'pushx, growx, sizegroup sp, span 2';
        var toggle = 'wrap, wmax 35, hmin 25, hmax 25';

        panel.place(
            strings.string('AHLCG-Class1'),
            'align right',
            list('CardClass', classList(o)),
            row,
            strings.string('AHLCG-Icon') + ' 1',
            'align right, gapx 10',
            list('Skill1', o.comboSkills),
            'wrap, ' + row,
            strings.string('AHLCG-Class2'),
            'align right',
            list('CardClass2', o.comboClassesD),
            row,
            strings.string('AHLCG-Icon') + ' 2',
            'align right',
            list('Skill2', o.comboSkills),
            'wrap, ' + row,
            strings.string('AHLCG-Class3'),
            'align right, gapx 10',
            list('CardClass3', o.comboClassesD),
            row,
            strings.string('AHLCG-Icon') + ' 3',
            'align right',
            list('Skill3', o.comboSkills),
            'wrap, ' + row,
            strings.string('AHLCG-Cost'),
            'align right, gapx 10',
            control('ResourceCost', new ui.textField('0', 10)),
            row,
            strings.string('AHLCG-Icon') + ' 4',
            'align right',
            list('Skill4', o.comboSkills),
            'wrap, ' + row,
            strings.string('AHLCG-Level'),
            'align right, gapx 10',
            list('Level', o.comboLevelsN),
            row,
            strings.string('AHLCG-Icon') + ' 5',
            'align right',
            list('Skill5', o.comboSkills),
            'wrap, ' + row,
            strings.string('AHLCG-Slot1'),
            'align right, gapx 10',
            list('Slot', o.comboSlots),
            'wrap, ' + row,
            strings.string('AHLCG-Slot2'),
            'align right, gapx 10',
            list('Slot2', o.comboSlots),
            'wrap, ' + row,
            strings.string('AHLCG-Stamina'),
            'align right, gapx 10',
            control('Stamina', new ui.textField('', 10)),
            'pushx, growx',
            control(
                'PerInvestigatorStamina',
                CardFace.iconButton('PerInvestigator')
            ),
            toggle,
            strings.string('AHLCG-Sanity'),
            'align right, gapx 10',
            control('Sanity', new ui.textField('', 10)),
            'pushx, growx',
            control(
                'PerInvestigatorSanity',
                CardFace.iconButton('PerInvestigator')
            ),
            toggle
        );
        return [{ panel: panel, title: strings.string('AHLCG-BasicData') }];
    };

    AssetFace.prototype.templateKey = function (diy, faceIndex) {
        var art = artClass(diy, this.suffix(faceIndex));
        return PlayerCard.templateKey(
            this,
            diy,
            faceIndex,
            PlayerCard.initial(art)
        );
    };

    // Name<initial>-region; a dual class title leaves room for the class
    // symbols, unless it is too long for one line
    AssetFace.prototype.paintClassName = function (
        g,
        diy,
        sheet,
        box,
        artClass,
        count
    ) {
        var faceIndex = sheet.getSheetIndex();
        var title = this.getTitle(diy, faceIndex);
        if (title.length === 0) return;
        if (String(diy.settings.get('Unique' + this.suffix(faceIndex))) === '1')
            title = '<uni>' + title;

        var region = diy.settings.getRegion(
            this.key(
                diy.settings,
                'Name' + PlayerCard.initial(artClass) + '-region'
            )
        );
        region.y += parseInt(FaceUtils.plugin().titleFontOffset);

        if (count >= 2) {
            // measuring with the box itself offsets the title
            let test = this.createBox(diy, sheet, 'Name');
            test.markupText = title;
            region.y -= 1;
            region.x += 30;
            region.width -= 55;
            if (count > 2) region.width -= 45;
            let height = test.measure(g, region);
            if (height < 22.0 || (height > 25.0 && title.length > 20)) {
                region.x -= 30;
                region.width += 30;
            }
        }

        title.split('\n').forEach(function (line) {
            box.markupText = line;
            box.drawAsSingleLine(g, region);
            region.y += 16;
            region.height -= 16;
        });
    };

    // the subtitle, over its own box where the art has no subtitled version
    AssetFace.prototype.paintClassSubtitle = function (
        g,
        diy,
        sheet,
        box,
        artClass,
        subtitle
    ) {
        var artInitial = PlayerCard.initial(artClass);
        if (
            !this.replaced &&
            !PlayerCard.hasSubtitledTemplate(this, diy, artInitial)
        ) {
            let image = imageutils.ImageUtils.get(
                'ArkhamHorrorLCG/overlays/AHLCG-Subtitle-' + artInitial + '.png'
            );
            let r = diy.settings.getRegion(
                this.key(diy.settings, 'Subtitle' + artInitial + '-region')
            );
            sheet.paintImage(
                g,
                image,
                new common.Region(
                    r.x + (r.width - image.getWidth()) / 2,
                    r.y,
                    image.getWidth(),
                    image.getHeight()
                )
            );
        }
        var text = diy.settings.getRegion(
            this.key(diy.settings, 'SubtitleText' + artInitial + '-region')
        );
        text.y += parseInt(FaceUtils.plugin().subtitleFontOffset);
        box.markupText = subtitle;
        box.drawAsSingleLine(g, text);
    };

    AssetFace.prototype.paintContent = function (
        g,
        diy,
        sheet,
        boxes,
        collector
    ) {
        var suffix = this.suffix(sheet.getSheetIndex());
        var cardClass = String(diy.settings.get('CardClass' + suffix, ''));
        var classes = PlayerCard.classes(diy, suffix);
        var art = artClass(diy, suffix);
        var story = isStory(cardClass);
        var subtitle = String(diy.settings.get('Subtitle' + suffix, ''));

        if (!this.replaced && classes.length > 1)
            PlayerCard.paintClassSymbols(this, g, diy, sheet, classes);

        // a story card's level circle is empty
        if (story) {
            if (!this.replaced)
                this.paintImage(
                    g,
                    diy,
                    sheet,
                    cardClass === 'Reward'
                        ? 'overlays/AHLCG-LevelCircle-RW-0.png'
                        : 'overlays/AHLCG-LevelCircle-' +
                              PlayerCard.initial(art) +
                              '-None.png',
                    'LevelCircle'
                );
        } else if (PlayerCard.isWeakness(cardClass)) {
            PlayerCard.paintWeaknessLevel(this, g, diy, sheet);
        } else {
            PlayerCard.paintLevel(
                this,
                g,
                diy,
                sheet,
                PlayerCard.initial(art),
                String(diy.settings.get('Level' + suffix, '0')),
                false
            );
        }
        PlayerCard.paintCircle(this, g, diy, sheet, cardClass, Circles);
        PlayerCard.paintWeaknessSubtype(this, g, diy, boxes.subtype, cardClass);

        var label = diy.settings.getRegion(
            this.key(diy.settings, 'Label-region')
        );
        if (cardClass === 'Neutral') label.y -= 1;
        label.y += parseInt(FaceUtils.plugin().typeFontOffset);
        boxes.label.markupText = String(
            strings.gstring(this.labelKey)
        ).toUpperCase();
        boxes.label.drawAsSingleLine(g, label);

        this.paintClassName(g, diy, sheet, boxes.name, art, classes.length);
        if (subtitle.length > 0)
            this.paintClassSubtitle(
                g,
                diy,
                sheet,
                boxes.subtitle,
                art,
                subtitle
            );

        var artInitial = PlayerCard.initial(art);
        PlayerCard.paintCost(
            this,
            g,
            diy,
            sheet,
            suffix,
            artInitial === 'W' || PlayerCard.hasLevelCircle(artInitial)
        );
        PlayerCard.paintSkillIcons(
            this,
            g,
            diy,
            sheet,
            suffix,
            story ? 'Neutral' : art,
            SkillCount
        );
        PlayerCard.paintSlots(this, g, diy, sheet, suffix);
        PlayerCard.paintStat(this, g, diy, sheet, suffix, 'Stamina');
        PlayerCard.paintStat(this, g, diy, sheet, suffix, 'Sanity');

        this.paintBody(g, diy, boxes.body, suffix);
        this.paintCollector(g, diy, sheet, boxes, collector, story, story);
    };

    // only a story card draws its encounter set
    AssetFace.prototype.showsEncounterTab = function (diy, faceIndex) {
        var cardClass = String(
            diy.settings.get('CardClass' + this.suffix(faceIndex), '')
        );
        return isStory(cardClass);
    };

    return AssetFace;
});
