// Enemy card: art, title and subtitle, fight, health and evade, damage and
// horror, and game text that follows the outline of the art window; or a
// weakness enemy (see CardFace), whose subtype line takes the subtitle's
// place.
//
// Module: returns EnemyFace.
define([
    'faces/CardFace',
    'faces/Face',
    'faces/FaceUtils',
    'se/imageutils',
    'se/strings',
    'se/ui',
], function (CardFace, Face, FaceUtils, imageutils, strings, ui) {
    function EnemyFace() {
        CardFace.call(this);
    }

    EnemyFace.prototype = Object.create(CardFace.prototype);
    EnemyFace.prototype.constructor = EnemyFace;
    EnemyFace.prototype.template = 'AHLCG-EnemyFace';
    EnemyFace.prototype.labelKey = 'AHLCG-Label-Enemy';
    EnemyFace.prototype.hasSubtitle = true;
    EnemyFace.prototype.fillReturnEncounterIcon = true;
    EnemyFace.prototype.subtypes = [
        'None',
        'BasicWeakness',
        'Weakness',
        'InvestigatorWeakness',
        'StoryWeakness',
    ];
    EnemyFace.prototype.weaknessOverlays = {
        BasicWeakness: 'BasicWeaknessEnemy',
        InvestigatorWeakness: 'PersonalWeaknessEnemy',
        StoryWeakness: 'BasicWeaknessEnemy',
    };

    // the setting of health's per investigator toggle
    EnemyFace.prototype.healthPerInvestigator = 'PerInvestigator';

    EnemyFace.prototype.defaultValues = function (diy, faceIndex) {
        return {
            Health: '2',
            PerInvestigator: '0',
            Attack: '2',
            PerInvestigatorAttack: '0',
            Evade: '2',
            PerInvestigatorEvade: '0',
            Damage: '0',
            Horror: '0',
        };
    };

    EnemyFace.prototype.createPanels = function (diy, bindings, faceIndex) {
        return [
            {
                panel: this.createStatPanel(bindings, faceIndex),
                title: strings.string('AHLCG-BasicData'),
            },
        ];
    };

    // stats, each with a per investigator toggle, and damage and horror
    EnemyFace.prototype.createStatPanel = function (bindings, faceIndex) {
        var o = FaceUtils.plugin();
        var face = this;
        var panel = new ui.Grid();

        function list(name, items) {
            var control = new ui.comboBox(items, null);
            face.bind(bindings, faceIndex, name, control);
            return control;
        }
        function perInvestigator(name) {
            var control = CardFace.iconButton('PerInvestigator');
            face.bind(bindings, faceIndex, name, control);
            return control;
        }
        var toggle = 'wmax 35, hmin 25, hmax 25';

        panel.place(
            strings.string('AHLCG-Type'),
            'align right',
            this.createSubtypeList(bindings, faceIndex),
            'wrap, pushx, growx, span 2',
            strings.string('AHLCG-Attack'),
            'align right',
            list('Attack', o.comboEnemyStat),
            'pushx, growx',
            perInvestigator('PerInvestigatorAttack'),
            toggle,
            strings.string('AHLCG-Damage'),
            'align right, gapx 10',
            list('Damage', o.combo5),
            'wrap, pushx, growx, sizegroup sp',
            strings.string('AHLCG-Health'),
            'align right',
            list('Health', o.comboEnemyHealth),
            'pushx, growx',
            perInvestigator('PerInvestigator'),
            toggle,
            strings.string('AHLCG-Horror'),
            'align right',
            list('Horror', o.combo5),
            'wrap, pushx, growx, sizegroup sp',
            strings.string('AHLCG-Evade'),
            'align right',
            list('Evade', o.comboEnemyStat),
            'pushx, growx',
            perInvestigator('PerInvestigatorEvade'),
            toggle
        );
        return panel;
    };

    // the text follows the outline of the art window
    EnemyFace.prototype.bodyShape = function (region) {
        return FaceUtils.plugin().getEnemyTextShape(region);
    };

    EnemyFace.prototype.templateKey = function (diy, faceIndex) {
        if (this.isWeakness())
            return CardFace.prototype.templateKey.call(this, diy, faceIndex);
        var subtitle = String(
            diy.settings.get('Subtitle' + this.suffix(faceIndex), '')
        );
        return subtitle.length > 0
            ? this.template + '-Subtitled-template'
            : null;
    };

    // a back without a title of its own shows the component name
    EnemyFace.prototype.getTitle = function (diy, faceIndex) {
        var title = Face.prototype.getTitle.call(this, diy, faceIndex);
        return title.length > 0 ? title : String(diy.name);
    };

    EnemyFace.prototype.paintContent = function (
        g,
        diy,
        sheet,
        boxes,
        collector
    ) {
        var suffix = this.suffix(sheet.getSheetIndex());
        var subtitle = String(diy.settings.get('Subtitle' + suffix, ''));

        this.paintLabel(g, diy, boxes.label);
        this.paintName(g, diy, sheet, boxes.name);
        if (this.isWeakness()) this.paintWeakness(g, diy, sheet, boxes);
        else if (subtitle.length > 0)
            this.paintSubtitle(g, diy, boxes.subtitle, subtitle);

        ['Attack', 'Evade'].forEach(function (stat) {
            this.paintStat(g, diy, sheet, stat, suffix);
        }, this);
        this.paintHealth(g, diy, sheet, suffix);
        this.paintBody(g, diy, boxes.body, suffix);
        this.paintTokens(g, diy, sheet, 'Damage', suffix);
        this.paintTokens(g, diy, sheet, 'Horror', suffix);

        var encounter = this.showsEncounter();
        this.paintCollector(
            g,
            diy,
            sheet,
            boxes,
            collector,
            encounter,
            encounter
        );
    };

    // a dash for '-'; a per investigator value is narrower, followed by the
    // per investigator symbol
    EnemyFace.prototype.paintStat = function (g, diy, sheet, stat, suffix) {
        var o = FaceUtils.plugin();
        var settings = diy.settings;
        var value = String(settings.get(stat + suffix, ''));
        var region = function (name) {
            return settings.getRegion(this.key(settings, name + '-region'));
        }.bind(this);

        if (value === '-') {
            let dash = region(stat);
            dash.y += 6;
            CardFace.outlined(sheet, g, '—', dash, o.costFont, 11.5);
        } else if (
            String(settings.get('PerInvestigator' + stat + suffix)) === '1'
        ) {
            let valueRegion = region(stat + 'PerInv');
            let iconRegion = region(stat + 'PerInvIcon');
            let size = 11.5;
            let symbolSize = 5.5;
            if (Number(value) === 1) {
                valueRegion.x -= 1;
                iconRegion.x -= 4;
            } else if (Number(value) > 9) {
                size = 10.5;
                symbolSize = 5.0;
                iconRegion.x += 4;
            }
            CardFace.outlined(sheet, g, value, valueRegion, o.enemyFont, size);
            CardFace.outlined(
                sheet,
                g,
                'p',
                iconRegion,
                o.symbolFont,
                symbolSize
            );
        } else {
            CardFace.outlined(sheet, g, value, region(stat), o.enemyFont, 11.0);
        }
    };

    EnemyFace.prototype.paintHealth = function (g, diy, sheet, suffix) {
        var o = FaceUtils.plugin();
        var settings = diy.settings;
        var health = String(settings.get('Health' + suffix, ''));
        var region = function (name) {
            return settings.getRegion(this.key(settings, name + '-region'));
        }.bind(this);

        if (health === '-') {
            let dash = region('HealthPerInv');
            dash.x += 5;
            dash.y += 6;
            CardFace.outlined(sheet, g, '—', dash, o.costFont, 11.5);
        } else if (
            String(settings.get(this.healthPerInvestigator + suffix)) === '1'
        ) {
            let valueRegion = region('HealthPerInv');
            let iconRegion = region('HealthPerInvIcon');
            let size = 13.5;
            if (health === 'X') {
                valueRegion.x += 2;
                iconRegion.x += 2;
            }
            if (Number(health) > 9) {
                size = 13.0;
                iconRegion.x += 4;
            }
            CardFace.outlined(sheet, g, health, valueRegion, o.enemyFont, size);
            CardFace.outlined(sheet, g, 'p', iconRegion, o.symbolFont, 6.5);
        } else {
            CardFace.outlined(
                sheet,
                g,
                health,
                region('Health'),
                o.enemyFont,
                13.5
            );
        }
    };

    // a Damage or Horror token for each point, up to five
    EnemyFace.prototype.paintTokens = function (g, diy, sheet, name, suffix) {
        var count = Number(diy.settings.get(name + suffix, '0'));
        var image = imageutils.ImageUtils.get(
            'ArkhamHorrorLCG/overlays/AHLCG-' + name + '.png'
        );
        for (let i = 1; i <= count; i++) {
            sheet.paintImage(
                g,
                image,
                diy.settings.getRegion(
                    this.key(diy.settings, name + i + '-region')
                )
            );
        }
    };

    return EnemyFace;
});
