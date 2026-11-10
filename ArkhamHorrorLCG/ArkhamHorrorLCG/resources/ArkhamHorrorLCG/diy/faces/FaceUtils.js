// Helpers shared by faces.
//
// Module: returns FaceUtils.
define(['se/common', 'se/java', 'se/strings', 'se/ui'], function (
    common,
    Java,
    strings,
    ui
) {
    const Path = Java.type('java.awt.geom.Path2D$Double');
    const GeometricShape = Java.type(
        'ca.cgjennings.layout.PageShape$GeometricShape'
    );
    const POINTS_PER_INCH = 72;
    const IconSizes = { s: '0.14in', m: '0.35in', l: '0.60in' };

    // the plug-in's shared state: fonts, offsets and icon lists
    function plugin() {
        return common.Eons.namedObjects.AHLCGObject;
    }

    function bleedPixels(sheet) {
        return Math.round(
            (sheet.getBleedMargin() / POINTS_PER_INCH) *
                sheet.getTemplateResolution()
        );
    }

    // Bleed margins come from the <templateKey>-bleed-margin settings, so
    // they are not saved with the component. Components saved by older
    // versions have an explicit margin of 0, which overrides the settings;
    // there is no API to unset it.
    function clearBleedMargin(diy) {
        try {
            let field = Java.type('java.lang.Class')
                .forName(
                    'ca.cgjennings.apps.arkham.diy.DIY',
                    false,
                    diy.getClass().getClassLoader()
                )
                .getDeclaredField('hasExplicitBleedMargin');
            field.setAccessible(true);
            field.setBoolean(diy, false);
        } catch (ex) {
            common.Eons.log.warning(
                'unable to clear bleed margin, using front face margin: ' + ex
            );
            diy.bleedMargin = diy.settings.getDouble(
                diy.frontTemplateKey + '-bleed-margin',
                0
            );
        }
    }

    // card regions are relative to the trim edge
    function translateToTrim(g, sheet) {
        var bleed = bleedPixels(sheet);
        g.translate(bleed, bleed);
    }

    // whether an encounter set or collection is offered; sets not yet
    // recorded in the user's choices are
    function isUsed(type, index) {
        var used = String(
            common.Settings.getUser().get(
                'AHLCG-Use' + type + Math.floor(index / 40 + 1),
                ''
            )
        );
        var i = index % 40;
        return used.length < i + 1 || used.charAt(i) === '1';
    }

    function setIconTags(box, tag, image) {
        for (let size in IconSizes) {
            box.setReplacementForTag(
                tag + size,
                '<image ' + image + ' ' + IconSizes[size] + ' baseline>'
            );
        }
    }

    function setUserIconTags(box, type) {
        var settings = common.Settings.getUser();
        var count = settings.getInt('AHLCG-User' + type + 'Count', 0);
        for (let i = 1; i <= count; i++) {
            if (!settings.getBoolean('AHLCG-UseUser' + type + i, true))
                continue;
            let tag = String(
                settings.get('AHLCG-User' + type + 'Tag' + i)
            ).toLowerCase();
            setIconTags(
                box,
                tag,
                '"' + settings.get('AHLCG-User' + type + 'Icon' + i) + '"'
            );
        }
    }

    // tags for card text: symbols, styles, encounter and collection icons
    function initBodyTags(diy, box) {
        var settings = diy.settings;
        var o = plugin();

        for (let i = 0; i < o.TagList.length; i++) {
            let item = o.TagList[i];
            let replacement = settings.get(item + '-tag-replacement');
            if (replacement != null && replacement.startsWith('#')) {
                replacement = strings.gstring(replacement.substring(1));
            }
            box.setReplacementForTag(settings.get(item + '-tag'), replacement);
        }

        for (let i = 0; i < o.StyleList.length; i++) {
            let item = o.StyleList[i];
            box.setStyleForTag(
                settings.get(item + '-tag'),
                settings.getTextStyle(item + '-style', null)
            );
        }

        box.setReplacementForTag('bultab', '     ');

        for (let i = 0; i < o.standardEncounterList.length; i++) {
            let entry = o.standardEncounterList[i];
            if (isUsed('Encounter', entry[3])) {
                setIconTags(
                    box,
                    entry[2],
                    'res://ArkhamHorrorLCG/icons/AHLCG-' + entry[0] + '.png'
                );
            }
        }
        setUserIconTags(box, 'Encounter');

        for (let i = 0; i < o.standardCollectionList.length; i++) {
            let entry = o.standardCollectionList[i];
            if (isUsed('Collection', entry[2])) {
                setIconTags(
                    box,
                    entry[1],
                    'res://ArkhamHorrorLCG/icons/AHLCG-' + entry[0] + '.png'
                );
            }
        }
        setUserIconTags(box, 'Collection');

        for (let i = 0; i < o.locationIcons.length; i++) {
            let item = o.locationIcons[i];
            let tag = settings.get('Loc' + item + '-tag');
            if (tag != null) {
                box.setReplacementForTag(
                    tag,
                    '<image res://ArkhamHorrorLCG/icons/AHLCG-Loc' +
                        item +
                        '.png 0.14in center>'
                );
            }
        }
    }

    function initCopyrightTags(diy, box) {
        plugin().CopyrightTagList.forEach(function (item) {
            box.setReplacementForTag(
                diy.settings.get(item + '-tag'),
                diy.settings.get(item + '-tag-replacement')
            );
        });
    }

    // A wrapped text area's preferred and minimum widths follow its current
    // width, so it would hold its tab open after widening. Call before layout.
    function textAreaWidth(area) {
        return 'w 0:' + area.getPreferredSize().width + ':';
    }

    // Game text fields for parts (Traits, Keywords, Header, Rules, Victory or
    // another name), keyed <part><partSuffix> and bound by face, with spacing
    // spinners between them, keyed <part><partSuffix><face suffix>Spacing as
    // legacy cards save them.
    function createTextPanel(
        face,
        bindings,
        faceIndex,
        parts,
        partSuffix,
        rulesRows
    ) {
        var panel = new ui.Grid();
        panel.setTitle(strings.string('AHLCG-Rules'));

        for (let i = 0; i < parts.length; i++) {
            let base = parts[i];
            let key = base + partSuffix;
            let label = strings.string('AHLCG-' + base);
            let field;
            let tipCount = 0;
            let inlineTips = false;

            switch (base) {
                case 'Traits':
                    field = new ui.textField('', 30);
                    tipCount = 4;
                    inlineTips = true;
                    break;
                case 'Keywords':
                    field = new ui.textArea('', 6, 30);
                    tipCount = 1;
                    break;
                case 'Header':
                    field = new ui.textArea('', 2, 30);
                    break;
                case 'Victory':
                    field = new ui.textArea('', 2, 30);
                    tipCount = 1;
                    break;
                case 'Rules':
                    field = new ui.textArea('', rulesRows, 30);
                    tipCount = 3;
                    break;
                default:
                    field = new ui.textArea('', 6, 30);
                    break;
            }
            face.bind(bindings, faceIndex, key, field);
            let width = textAreaWidth(field);

            if (tipCount === 0) {
                panel.place(
                    label,
                    'aligny top, gaptop 5, align right',
                    field,
                    'wrap, pushx, growx, ' + width
                );
            } else if (inlineTips) {
                panel.place(
                    label,
                    'aligny top, gaptop 5, align right',
                    field,
                    'split' + tipCount + ', pushx, growx, ' + width
                );
            } else {
                panel.place(
                    label,
                    'spany ' + tipCount + ', aligny top, gaptop 5, align right',
                    field,
                    'spany ' + tipCount + ', pushx, growx, ' + width
                );
            }

            for (let tip = 1; tip <= tipCount; tip++) {
                let button = new ui.tipButton(
                    strings.string('AHLCG-' + base + 'Tip' + tip)
                );
                let wrap = !inlineTips || tip === tipCount;
                panel.place(
                    button,
                    (wrap ? 'wrap, ' : '') + 'aligny top, gaptop 5'
                );
            }

            if (i + 1 < parts.length) {
                let spacing = new ui.spinner(0, 50, 1, 1);
                face.bindKey(
                    bindings,
                    faceIndex,
                    key + face.suffix(faceIndex) + 'Spacing',
                    spacing
                );
                panel.place(
                    strings.string('AHLCG-Spacing'),
                    'align right',
                    spacing,
                    'wrap'
                );
            }
        }

        return panel;
    }

    // alignment, start and end markup of each part
    const PartFormats = {
        Traits: ['<center>', '<ts>', '</ts>'],
        Keywords: ['<left>', '', ''],
        Rules: ['<left>', '', ''],
        Flavor: ['<center>', '<fs>', '</fs>'],
        Victory: ['<center>', '<vic>', '</vic>'],
    };

    function spacer(points) {
        return (
            '<image res://ArkhamHorrorLCG/images/empty1x1.png 1pt ' +
            points +
            'pt>'
        );
    }

    // Markup for the parts with text, keyed <part><suffix>, each on its own
    // line and followed by its <part><suffix>Spacing in points, if it has
    // one. An empty Traits part leaves a little space. formats gives
    // [ alignment, start, end ] for parts other than the standard ones.
    function partsMarkup(settings, parts, suffix, formats) {
        var text = '';
        if (
            parts.indexOf('Traits') >= 0 &&
            String(settings.get('Traits' + suffix, '')) === ''
        )
            text = spacer(6);

        parts.forEach(function (part) {
            let entry = String(settings.get(part + suffix, ''));
            if (entry !== '') {
                let format = (formats && formats[part]) || PartFormats[part];
                if (text !== '') text += '\n';
                text += format[0] + format[1] + entry + format[2];
            }

            let spacing = settings.get(part + suffix + 'Spacing');
            if (spacing == null) return;
            spacing = Math.max(Number(spacing), 0);
            if (entry !== '')
                text +=
                    '\n' + spacer((part === 'Traits' ? 0.5 : 1.5) + spacing);
            else if (spacing > 0) text += spacer(spacing);
        });
        return text;
    }

    // A page shape for text in region, the polygon through the points given
    // as fractions of its width and height. The plug-in's own shapes keep the
    // region of whichever card asks first.
    function polygonShape(region, xs, ys) {
        var path = new Path();
        path.moveTo(
            region.x + region.width * xs[0],
            region.y + region.height * ys[0]
        );
        for (let i = 1; i < xs.length; i++)
            path.lineTo(
                region.x + region.width * xs[i],
                region.y + region.height * ys[i]
            );
        path.closePath();
        return new GeometricShape(path, region);
    }

    return {
        polygonShape: polygonShape,
        createTextPanel: createTextPanel,
        partsMarkup: partsMarkup,
        textAreaWidth: textAreaWidth,
        plugin: plugin,
        isUsed: isUsed,
        bleedPixels: bleedPixels,
        clearBleedMargin: clearBleedMargin,
        translateToTrim: translateToTrim,
        initBodyTags: initBodyTags,
        initCopyrightTags: initCopyrightTags,
    };
});
