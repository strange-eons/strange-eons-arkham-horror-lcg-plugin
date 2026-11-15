// Player event: class art, or dual and triple class art with class symbols,
// title, cost, level, skill icons and game text in the event's curved
// outline. A Weakness, BasicWeakness or StoryWeakness class card is a
// weakness event; a Story or StoryWeakness one shows its encounter set.
//
// Module: returns EventFace.
define([
    'faces/CardFace',
    'faces/FaceUtils',
    'faces/PlayerCard',
    'se/strings',
    'se/ui',
], function (CardFace, FaceUtils, PlayerCard, strings, ui) {
    const SkillCount = 5;
    // the circle by the title's region, by class
    const Circles = {
        Story: 'Encounter-overlay',
        StoryWeakness: 'StoryWeakness-overlay',
        BasicWeakness: 'BasicWeaknessEvent',
    };
    // nudges of each pair of dual class symbols
    const SymbolOffsets = {
        GK: [0, 0],
        GR: [1, -1],
        GM: [1, -3],
        GV: [0, 2],
        KG: [-2, -1],
        KR: [-1, -1],
        KM: [0, -3],
        KV: [-2, 1],
        RG: [0, 0],
        RK: [0, 0],
        RM: [2, -2],
        RV: [-1, 2],
        MG: [-1, 1],
        MK: [-1, 1],
        MR: [1, 1],
        MV: [-1, 3],
        VG: [2, -1],
        VK: [1, -1],
        VR: [2, -2],
        VM: [3, -4],
    };

    function EventFace() {
        CardFace.call(this);
    }

    EventFace.prototype = Object.create(CardFace.prototype);
    EventFace.prototype.constructor = EventFace;
    EventFace.prototype.template = 'AHLCG-EventFace';
    EventFace.prototype.labelKey = 'AHLCG-Label-Event';

    EventFace.prototype.defaultValues = function (diy, faceIndex) {
        var values = {
            CardClass: 'Guardian',
            CardClass2: 'None',
            CardClass3: 'None',
            ResourceCost: '0',
            Level: '0',
        };
        for (let i = 1; i <= SkillCount; i++) values['Skill' + i] = 'None';
        return values;
    };

    EventFace.prototype.createPanels = function (diy, bindings, faceIndex) {
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
        var cell = 'pushx, growx, sizegroup sp';
        function icon(n) {
            return strings.string('AHLCG-Icon') + ' ' + n;
        }

        panel.place(
            strings.string('AHLCG-Class1'),
            'align right',
            list('CardClass', o.comboClassesBWS),
            cell,
            icon(1),
            'align right, gapx 10',
            list('Skill1', o.comboSkills),
            'wrap, ' + cell,
            strings.string('AHLCG-Class2'),
            'align right',
            list('CardClass2', o.comboClassesD),
            cell,
            icon(2),
            'align right, gapx 10',
            list('Skill2', o.comboSkills),
            'wrap, ' + cell,
            strings.string('AHLCG-Class3'),
            'align right',
            list('CardClass3', o.comboClassesD),
            cell,
            icon(3),
            'align right, gapx 10',
            list('Skill3', o.comboSkills),
            'wrap, ' + cell,
            strings.string('AHLCG-Cost'),
            'align right',
            control('ResourceCost', new ui.textField('0', 10)),
            cell,
            icon(4),
            'align right, gapx 10',
            list('Skill4', o.comboSkills),
            'wrap, ' + cell,
            strings.string('AHLCG-Level'),
            'align right',
            list('Level', o.comboLevelsN),
            cell,
            icon(5),
            'align right, gapx 10',
            list('Skill5', o.comboSkills),
            cell
        );
        return [{ panel: panel, title: strings.string('AHLCG-BasicData') }];
    };

    // the outline is the plug-in's, from the plain body region
    EventFace.prototype.bodyShape = function (region) {
        return FaceUtils.plugin().getEventTextShape(region);
    };

    // dual and triple class art is one template
    EventFace.prototype.templateKey = function (diy, faceIndex) {
        var suffix = this.suffix(faceIndex);
        var classes = PlayerCard.classes(diy, suffix);
        var second = diy.settings.get('CardClass2' + suffix);
        var third = diy.settings.get('CardClass3' + suffix);
        var art =
            second != null && third != null && classes.length > 1
                ? 'D'
                : PlayerCard.artInitial(classes[0]);
        return PlayerCard.templateKey(this, diy, faceIndex, art);
    };

    // Each symbol of a dual or triple class card in ClassSymbol<count><n>,
    // nudged for the pair it is in.
    EventFace.prototype.paintClassSymbols = function (g, diy, sheet, classes) {
        var count = classes.length;
        var initials = classes.map(PlayerCard.initial);
        var pair = initials[0] + initials[1];
        for (let i = 1; i <= count; i++) {
            let offset;
            if (i === 1) {
                offset = SymbolOffsets[pair][0];
                if (count > 2) offset += SymbolOffsets[pair][1];
            } else if (i === 2) {
                offset = count === 3 ? 0 : SymbolOffsets[pair][1];
            } else {
                let last = initials[1] + initials[2];
                offset = SymbolOffsets[last][0] + SymbolOffsets[last][1];
            }
            let r = diy.settings.getRegion(
                this.key(diy.settings, 'ClassSymbol' + count + i + '-region')
            );
            if (i === 1) r.x -= offset;
            else r.x += offset;
            this.paintImage(
                g,
                diy,
                sheet,
                'overlays/AHLCG-ClassSymbol-' + initials[i - 1] + '.png',
                null,
                r
            );
        }
    };

    // a story weakness's encounter icon sits in the weakness circle
    EventFace.prototype.readKeyVariant = PlayerCard.readKeyVariant;

    EventFace.prototype.paintContent = function (
        g,
        diy,
        sheet,
        boxes,
        collector
    ) {
        var o = FaceUtils.plugin();
        var suffix = this.suffix(sheet.getSheetIndex());
        var cardClass = String(diy.settings.get('CardClass' + suffix, ''));
        var classes = PlayerCard.classes(diy, suffix);
        var artClass = PlayerCard.artClass(diy, suffix);
        var art = PlayerCard.artInitial(cardClass);
        var weakness = PlayerCard.isWeakness(cardClass);

        if (
            !this.replaced &&
            classes.length > 1 &&
            diy.settings.get('CardClass2' + suffix) != null &&
            diy.settings.get('CardClass3' + suffix) != null
        )
            this.paintClassSymbols(g, diy, sheet, classes);

        var label = diy.settings.getRegion(
            this.key(diy.settings, 'Label-region')
        );
        label.y += parseInt(o.typeFontOffset);
        if (String(o.bodyFamily) === 'Times New Roman') label.y += 1;
        boxes.label.markupText = String(
            strings.gstring(this.labelKey)
        ).toUpperCase();
        boxes.label.drawAsSingleLine(g, label);

        // the title sits higher on weakness art, and on neutral or level
        // circle art
        var lift = 0;
        if (art === 'W') lift = 3;
        else if (
            art === 'N' ||
            (PlayerCard.hasLevelCircle(art) && !this.replaced)
        )
            lift = 2;
        this.paintName(g, diy, sheet, boxes.name, lift);

        if (weakness) PlayerCard.paintWeaknessLevel(this, g, diy, sheet);
        else
            PlayerCard.paintLevel(
                this,
                g,
                diy,
                sheet,
                PlayerCard.artInitial(artClass),
                String(diy.settings.get('Level' + suffix, '0')),
                false
            );
        PlayerCard.paintCircle(this, g, diy, sheet, cardClass, Circles);
        PlayerCard.paintWeaknessSubtype(this, g, diy, boxes.subtype, cardClass);

        PlayerCard.paintCost(
            this,
            g,
            diy,
            sheet,
            suffix,
            art === 'W' || PlayerCard.hasLevelCircle(art)
        );
        PlayerCard.paintSkillIcons(
            this,
            g,
            diy,
            sheet,
            suffix,
            artClass,
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

        var story = cardClass === 'Story' || cardClass === 'StoryWeakness';
        this.paintCollector(g, diy, sheet, boxes, collector, story, story);
    };

    // only a story card draws its encounter set
    EventFace.prototype.showsEncounterTab = function (diy, faceIndex) {
        var cardClass = String(
            diy.settings.get('CardClass' + this.suffix(faceIndex), '')
        );
        return cardClass === 'Story' || cardClass === 'StoryWeakness';
    };

    return EventFace;
});
