// Drawing shared by player card faces: class templates and symbols, level,
// cost, skill icons, slots, health and sanity. Regions are the face's own
// (face.key); images are plug-in overlays.
//
// Classes are stored by name as legacy cards save them: CardClass<suffix>,
// and for a dual or triple class card CardClass2<suffix>, CardClass3<suffix>.
//
// Module: returns PlayerCard.
define([
    'faces/CardFace',
    'faces/FaceUtils',
    'se/imageutils',
    'se/java',
], function (CardFace, FaceUtils, imageutils, Java) {
    const Color = Java.type('java.awt.Color');
    const TintFilter = Java.type('ca.cgjennings.graphics.filters.TintFilter');
    const Initials = {
        Guardian: 'G',
        ParallelGuardian: 'GP',
        Seeker: 'K',
        ParallelSeeker: 'KP',
        Rogue: 'R',
        ParallelRogue: 'RP',
        Mystic: 'M',
        ParallelMystic: 'MP',
        Survivor: 'V',
        ParallelSurvivor: 'VP',
        Weakness: 'W',
        BasicWeakness: 'W',
        Encounter: 'E',
        Neutral: 'N',
        Specialist: 'P',
        ParallelNeutral: 'NP',
        Story: 'S',
        StoryWeakness: 'SW',
        Dual: 'D',
        Test: 'T',
        Reward: 'RW',
    };
    // classes whose art has a level circle drawn over it
    const LevelCircleClasses = ['D', 'G', 'K', 'M', 'N', 'P', 'R', 'V', 'RW'];
    const WeaknessClasses = ['Weakness', 'BasicWeakness', 'StoryWeakness'];
    const SkillInitials = {
        Willpower: 'W',
        Intellect: 'I',
        Combat: 'C',
        Agility: 'A',
    };

    function initial(className) {
        return Initials[className] || '';
    }

    // the initial of the art for a class: event and skill art draws story
    // cards as neutral and story weaknesses as weaknesses
    function artInitial(className, storyArt) {
        var i = initial(className);
        if (storyArt) return i;
        if (i === 'S' || i === 'RW') return 'N';
        if (i === 'SW') return 'W';
        return i;
    }

    function image(path) {
        return imageutils.ImageUtils.get('ArkhamHorrorLCG/' + path);
    }

    function region(face, diy, name) {
        return diy.settings.getRegion(face.key(diy.settings, name + '-region'));
    }

    function get(diy, name, suffix) {
        return String(diy.settings.get(name + suffix, ''));
    }

    // the card's classes, the first always; others only for a card of a
    // class that can be combined
    function classes(diy, suffix) {
        var first = get(diy, 'CardClass', suffix);
        var second = String(diy.settings.get('CardClass2' + suffix, 'None'));
        var third = String(diy.settings.get('CardClass3' + suffix, 'None'));
        var list = [first];
        if (second === 'None' && third === 'None') return list;
        if (['G', 'K', 'R', 'M', 'V'].indexOf(initial(first)) < 0) return list;
        if (second !== first && second !== 'None') list.push(second);
        if (third !== first && third !== second && third !== 'None')
            list.push(third);
        return list;
    }

    // the class the art is drawn for: Dual for several classes
    function artClass(diy, suffix) {
        var list = classes(diy, suffix);
        return list.length > 1 ? 'Dual' : list[0];
    }

    function isWeakness(className) {
        return WeaknessClasses.indexOf(className) >= 0;
    }

    // <template>-<initial>[S]-template, the subtitled one if the side has a
    // subtitle and there is one, or null
    function templateKey(face, diy, faceIndex, artInitial) {
        var key = face.template + '-' + artInitial;
        var subtitle = get(diy, 'Subtitle', face.suffix(faceIndex));
        if (subtitle.length > 0 && diy.settings.get(key + 'S-template') != null)
            return key + 'S-template';
        return diy.settings.get(key + '-template') != null
            ? key + '-template'
            : null;
    }

    // whether art of the class has a level circle drawn over it
    function hasLevelCircle(artInitial) {
        return LevelCircleClasses.indexOf(artInitial) >= 0;
    }

    function hasSubtitledTemplate(face, diy, artInitial) {
        return (
            diy.settings.get(face.template + '-' + artInitial + 'S-template') !=
            null
        );
    }

    // the symbol of each class of a dual or triple class card, right aligned
    function paintClassSymbols(face, g, diy, sheet, list) {
        var start = 3 - list.length;
        list.forEach(function (className, i) {
            sheet.paintImage(
                g,
                image(
                    'overlays/AHLCG-ClassSymbol-' + initial(className) + '.png'
                ),
                region(face, diy, 'ClassSymbol' + (i + 1 + start))
            );
        });
    }

    function paintLevelCircle(face, g, diy, sheet, circle, level) {
        sheet.paintImage(
            g,
            image(
                'overlays/AHLCG-LevelCircle-' + circle + '-' + level + '.png'
            ),
            region(face, diy, 'LevelCircle')
        );
    }

    // A level circle on art without one; otherwise the no level box or level
    // pips. skillCircle: skill art shares one circle below the class symbol.
    function paintLevel(face, g, diy, sheet, artInitial, level, skillCircle) {
        if (LevelCircleClasses.indexOf(artInitial) >= 0) {
            let circle =
                skillCircle && artInitial !== 'P' ? 'Skill' : artInitial;
            paintLevelCircle(face, g, diy, sheet, circle, level);
            return;
        }
        if (level === 'None') {
            sheet.paintImage(
                g,
                image(
                    skillCircle
                        ? 'overlays/AHLCG-NoLevelSkill.png'
                        : 'overlays/AHLCG-NoLevel.png'
                ),
                region(face, diy, 'NoLevel')
            );
        } else if (Number(level) > 0) {
            sheet.paintImage(
                g,
                image('overlays/AHLCG-Level-' + level + '.png'),
                region(face, diy, 'Level')
            );
        }
    }

    // the unleveled circle of weakness art; skill art's shared one
    function paintWeaknessLevel(face, g, diy, sheet, skillCircle) {
        paintLevelCircle(
            face,
            g,
            diy,
            sheet,
            skillCircle ? 'Skill' : 'W',
            'None'
        );
    }

    // The circle by the title: a story card's encounter set circle, or the
    // weakness circle of a story or basic weakness, a basic weakness's with
    // its icon. regions maps each class with a circle to the face's
    // <region>-region; a replacement template has its own.
    function paintCircle(face, g, diy, sheet, className, regions) {
        var region = regions[className];
        if (face.replaced || region == null) return;
        face.paintImage(
            g,
            diy,
            sheet,
            isWeakness(className)
                ? 'overlays/AHLCG-BasicWeaknessAsset.png'
                : 'overlays/AHLCG-Asset-EncounterSetOverlay.png',
            region
        );
        if (className === 'BasicWeakness')
            face.paintImage(
                g,
                diy,
                sheet,
                'icons/AHLCG-BasicWeakness.png',
                'BasicWeaknessIcon'
            );
    }

    // a weakness's subtype line
    // a face's readKeyVariant: a story weakness class's own settings
    function readKeyVariant(diy, faceIndex) {
        var className = String(
            diy.settings.get('CardClass' + this.suffix(faceIndex), '')
        );
        return className === 'StoryWeakness' ? className : null;
    }

    function paintWeaknessSubtype(face, g, diy, box, className) {
        if (!isWeakness(className)) return;
        face.paintSubtype(
            g,
            diy,
            box,
            className === 'BasicWeakness'
                ? 'AHLCG-Label-BasicWeakness'
                : 'AHLCG-Label-Weakness'
        );
    }

    // a dash image tinted by the face's Dash-tint
    function paintDash(face, g, diy, sheet, r, offsetX, offsetY) {
        r.x = r.x + (r.width - 26) / 2 + offsetX;
        r.y = r.y + (r.height - 10) / 2 + (offsetY || 0);
        r.width = 26;
        r.height = 10;
        var hsb = diy.settings.getTint(face.key(diy.settings, 'Dash-tint'));
        var dash = imageutils.ImageUtils.get(
            hsb[2] >= 0
                ? 'ArkhamHorrorLCG/numbers/AHLCG-Cost--.png'
                : 'ArkhamHorrorLCG/numbers/AHLCG-Cost--Inverted.png',
            true
        );
        var filter = new TintFilter(hsb[0], hsb[1], Math.abs(hsb[2]));
        sheet.paintImage(g, filter.filter(dash, null), r);
    }

    // centered: the dash sits on the level circle or weakness art's center
    function paintCost(face, g, diy, sheet, suffix, centered) {
        var o = FaceUtils.plugin();
        var cost = get(diy, 'ResourceCost', suffix);
        var r = region(face, diy, 'Cost');
        if (cost === '-') paintDash(face, g, diy, sheet, r, centered ? 0 : 2);
        else
            CardFace.outlined(
                sheet,
                g,
                cost,
                r,
                o.costFont,
                cost === 'X' ? 14.0 : 16.0
            );
    }

    // className: the art's class, for the boxes; a weakness has its own
    // icons. eventArt: as event and skill art draws the class.
    function paintSkillIcons(
        face,
        g,
        diy,
        sheet,
        suffix,
        className,
        count,
        eventArt
    ) {
        var boxInitial = eventArt ? artInitial(className) : initial(className);
        var weakness = isWeakness(className);
        for (let i = 1; i <= count; i++) {
            let skill = String(diy.settings.get('Skill' + i + suffix, 'None'));
            if (skill === 'None') continue;
            sheet.paintImage(
                g,
                image('overlays/AHLCG-SkillBox-' + boxInitial + '.png'),
                region(face, diy, 'Skill' + i)
            );
            sheet.paintImage(
                g,
                image(
                    'overlays/AHLCG-SkillIcon-' +
                        (SkillInitials[skill] || 'D') +
                        (weakness ? 'W' : '') +
                        '.png'
                ),
                region(face, diy, 'SkillIcon' + i)
            );
        }
    }

    // one slot, or two with the first in Slot2's place
    function paintSlots(face, g, diy, sheet, suffix) {
        var first = String(diy.settings.get('Slot' + suffix, 'None'));
        var second = String(diy.settings.get('Slot2' + suffix, 'None'));
        if (second !== 'None') {
            sheet.paintImage(
                g,
                image('overlays/AHLCG-Slot-' + first + '.png'),
                region(face, diy, 'Slot2')
            );
            sheet.paintImage(
                g,
                image('overlays/AHLCG-Slot-' + second + '.png'),
                region(face, diy, 'Slot')
            );
        } else if (first !== 'None') {
            sheet.paintImage(
                g,
                image('overlays/AHLCG-Slot-' + first + '.png'),
                region(face, diy, 'Slot')
            );
        }
    }

    const Light = new Color(0.996, 0.945, 0.859);
    const Stats = {
        Stamina: {
            outline: new Color(0.68, 0.12, 0.22),
            x: { '-': -1, X: -2, '': -1, '*': -2, 1: -1, 2: -2, 3: -2 },
            y: { '-': -5, '*': 14, X: -4, '': -1, 1: -3, 2: -3, 3: -3, 4: -3 },
            defaultX: -1,
            defaultY: -4,
        },
        Sanity: {
            outline: new Color(0.25, 0.33, 0.44),
            x: { '-': 0, X: -2, '': -1, '*': 0, 1: -1, 4: -1, 8: -1 },
            y: { '-': -7, X: -4, '': -1, '*': 12, 1: -5, 2: -5, 3: -5, 4: -5 },
            defaultX: 0,
            defaultY: -6,
        },
    };

    // Health (Stamina) or Sanity on its base: a dash, a star, a per
    // investigator value or a number, each offset to sit on the base.
    function paintStat(face, g, diy, sheet, suffix, name) {
        var o = FaceUtils.plugin();
        var stat = Stats[name];
        var value = get(diy, name, suffix);
        if (value === 'None') return;
        if (value === 'Star') value = '*';

        var r = region(face, diy, name);
        sheet.paintImage(g, image('overlays/AHLCG-' + name + 'Base.png'), r);
        var known = /^(-|X|\*|)$/.test(value) || /^([1-9]|1[0-5])$/.test(value);
        var key = known ? value : 'X';
        r.x += key in stat.x ? stat.x[key] : stat.defaultX;
        r.y += key in stat.y ? stat.y[key] : stat.defaultY;

        function title(text, area, font, size) {
            sheet.drawOutlinedTitle(
                g,
                text,
                area,
                font,
                size,
                1.5,
                Light,
                stat.outline,
                0,
                true
            );
        }

        if (value === '-') title(value, r, o.symbolFont, 9.8);
        else if (value === '*') title(value, r, o.costFont, 18.5);
        else if (
            String(diy.settings.get('PerInvestigator' + name + suffix)) === '1'
        ) {
            let icon = region(face, diy, name + 'PerInvIcon');
            r.x -= 5;
            let size = 14;
            let symbolSize = 6.5;
            if (Number(value) === 1) {
                r.x -= 1;
                icon.x -= 4;
            } else if (Number(value) > 9) {
                size = 12;
                symbolSize = 5.5;
                icon.x += 4;
            }
            title(value, r, o.enemyFont, size);
            title('p', icon, o.symbolFont, symbolSize);
        } else if (value.length > 1) title(value, r, o.enemyFont, 11.5);
        else title(value, r, o.enemyFont, 14);
    }

    return {
        initial: initial,
        artInitial: artInitial,
        classes: classes,
        artClass: artClass,
        isWeakness: isWeakness,
        templateKey: templateKey,
        hasLevelCircle: hasLevelCircle,
        hasSubtitledTemplate: hasSubtitledTemplate,
        paintClassSymbols: paintClassSymbols,
        paintLevel: paintLevel,
        paintWeaknessLevel: paintWeaknessLevel,
        paintCircle: paintCircle,
        paintWeaknessSubtype: paintWeaknessSubtype,
        readKeyVariant: readKeyVariant,
        paintCost: paintCost,
        paintDash: paintDash,
        paintSkillIcons: paintSkillIcons,
        paintSlots: paintSlots,
        paintStat: paintStat,
    };
});
