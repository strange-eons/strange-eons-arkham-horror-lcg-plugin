// A legacy handler's portraits: created from its portrait type list, read
// and written in that order, painted, and the editor buttons that mirror or
// invert one.
//
// Module: returns { create, read, write, paint, mirrorButton, invertButton,
// setFileFieldEnabled }.
define([
    'faces/FaceUtils',
    'faces/PortraitArt',
    'se/common',
    'se/imageutils',
    'se/java',
    'se/strings',
    'se/ui',
], function (FaceUtils, PortraitArt, common, imageutils, Java, strings, ui) {
    const DefaultPortrait = Java.type(
        'ca.cgjennings.apps.arkham.component.DefaultPortrait'
    );
    const FACE_FRONT = 0;
    const FACE_BACK = 1;
    // old base key parts, and what replaced them
    const Renamed = [
        ['EncounterPortrait', 'Encounter'],
        ['CollectionPortrait', 'Collection'],
        ['-Investigator-PortraitPortrait', '-InvestigatorBack-Portrait'],
        ['PortraitPortrait', 'Portrait'],
    ];
    const Placement = ['template', 'panx', 'pany', 'rotation', 'scale'];

    // sets the face's portrait template, rotation and clip region where the
    // card type has none, the region from the <key> portrait
    function setDefaults(card, diy, faceIndex, key, portraitKey) {
        var settings = diy.settings;
        var own = 'AHLCG-' + card.type(faceIndex) + '-' + portraitKey;
        function missing(part) {
            var found = settings.get(
                card.key(faceIndex, portraitKey + '-portrait-' + part),
                ''
            );
            return String(found) === '';
        }
        if (missing('template'))
            settings.set(
                own + '-portrait-template',
                'ArkhamHorrorLCG/images/empty1x1.png'
            );
        if (missing('rotation')) settings.set(own + '-portrait-rotation', '0');
        if (missing('clip-region'))
            settings.set(
                own + '-portrait-clip-region',
                settings.get(card.key(faceIndex, key + '-portrait-clip-region'))
            );
    }

    // the portrait for <name>-<faces>, at its index in the list
    function createOne(card, diy, fullKey) {
        var parts = fullKey.split('-');
        var key = parts[0];
        var faces = parts[1];
        var update = faces === 'Back' || faces === 'Both' ? [0, 1] : [0];
        var settingsFace = faces === 'Back' ? FACE_BACK : FACE_FRONT;
        var fill = false;
        var rotate = true;
        var minimum = false;
        if (key === 'Portrait' || key === 'BackPortrait') fill = true;
        else if (key === 'TransparentPortrait') rotate = false;
        else if (key === 'Portrait1' || key === 'Portrait2') {
            rotate = false;
            minimum = true;
        }

        setDefaults(card, diy, settingsFace, key, key);
        if (faces === 'Both') setDefaults(card, diy, FACE_BACK, key, key);
        var portrait = new DefaultPortrait(
            diy,
            card.key(settingsFace, key, '-portrait-template'),
            rotate
        );
        portrait.facesToUpdate = update;
        portrait.backgroundFilled = fill;
        portrait.setScaleUsesMinimum(minimum);
        portrait.installDefault();
        card.portraits[card.portraitIndex(key)] = portrait;
    }

    function create(card, diy) {
        diy.customPortraitHandling = true;
        card.portraitTypes.forEach(function (fullKey) {
            createOne(card, diy, fullKey);
        });
    }

    // Older versions chose Player and Encounter backs by saving a template
    // path over the face's template setting; the back type alone now selects
    // the template.
    function clearTemplateOverrides(diy) {
        for (let it = diy.settings.getKeySet().iterator(); it.hasNext();) {
            let key = String(it.next());
            if (/^AHLCG-.*-Default-template$/.test(key))
                diy.settings.reset(key);
        }
    }

    // moves a portrait saved under an older base key to the current one
    function renamed(card, diy, portrait) {
        var key = String(portrait.getBaseKey());
        var pair = Renamed.filter(function (p) {
            return key.indexOf(p[0]) >= 0;
        })[0];
        if (pair == null) return portrait;

        var base = key.split(pair[0])[0];
        Placement.forEach(function (part) {
            diy.settings.set(
                base + pair[1] + '-portrait-' + part,
                card.settings.get(base + pair[0] + '-portrait-' + part)
            );
        });
        Placement.forEach(function (part) {
            diy.settings.reset(base + pair[0] + '-portrait-' + part);
        });
        return new DefaultPortrait(key.replace(pair[0], pair[1]), portrait);
    }

    // Reads the portraits in list order; one that can't be read is created
    // anew. Older WeaknessEnemy and WeaknessTreachery saves have no
    // encounter portrait unless readEncounter.
    function read(card, diy, oos, readEncounter) {
        FaceUtils.clearBleedMargin(diy);
        clearTemplateOverrides(diy);
        card.portraitTypes.forEach(function (fullKey, index) {
            if (fullKey.split('-')[0] === 'Encounter' && !readEncounter) {
                createOne(card, diy, fullKey);
                return;
            }
            try {
                card.portraits[index] = oos.readObject();
            } catch (ex) {
                createOne(card, diy, fullKey);
            }
            card.portraits[index] = renamed(card, diy, card.portraits[index]);
        });
    }

    function write(card, oos) {
        card.portraitTypes.forEach(function (fullKey, index) {
            oos.writeObject(card.portraits[index]);
        });
    }

    function paint(card, g, diy, sheet, name) {
        PortraitArt.paint(g, diy, sheet, card.portrait(name));
    }

    // replaces the portrait's image, keeping its placement
    function replaceImage(portrait, image) {
        var scale = portrait.getScale();
        var rotation = portrait.getRotation();
        var panX = portrait.getPanX();
        var panY = portrait.getPanY();
        portrait.setImage(portrait.getSource(), image);
        portrait.setScale(scale);
        portrait.setRotation(rotation);
        portrait.setPanX(panX);
        portrait.setPanY(panY);
    }

    function mirrorButton(card, name, panel) {
        var index = card.portraitIndex(name);
        return new ui.button(strings.string('AHLCG-Mirror'), null, function () {
            var portrait = card.portraits[index];
            replaceImage(
                portrait,
                imageutils.ImageUtils.mirror(portrait.getImage(), true, false)
            );
            panel.updatePanel();
        });
    }

    function invertButton(card, name) {
        var index = card.portraitIndex(name);
        return new ui.button('Invert', null, function () {
            var portrait = card.portraits[index];
            replaceImage(
                portrait,
                imageutils.ImageUtils.invert(portrait.getImage())
            );
        });
    }

    function setFileFieldEnabled(panel, enabled) {
        var components = panel.getComponents();
        for (let i = 0; i < components.length; i++) {
            if (/TextField/.test(components[i].getClass().getName()))
                components[i].setEnabled(enabled);
        }
    }

    return {
        create: create,
        read: read,
        write: write,
        paint: paint,
        mirrorButton: mirrorButton,
        invertButton: invertButton,
        setFileFieldEnabled: setFileFieldEnabled,
    };
});
