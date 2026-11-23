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
    const Rectangle = Java.type('java.awt.geom.Rectangle2D$Double');
    const ArrayList = Java.type('java.util.ArrayList');
    const AttributedString = Java.type('java.text.AttributedString');
    const Font = Java.type('java.awt.Font');
    const POINTS_PER_INCH = 72;
    const IconSizes = { s: '0.14in', m: '0.35in', l: '0.60in' };
    const ARROW = 'res://ArkhamHorrorLCG/icons/AHLCG-Arrow.png';
    const ARROW_WIDTH = 0.23;
    const ARROW_HEIGHT = (ARROW_WIDTH * 150) / 524;

    // How far down to move a region so a middle-aligned single line has its
    // capitals, rather than its ascent and descent, centered in the region.
    // The renderer clamps the line's top to the region's top.
    function capShift(height, capHeight, ascent, descent) {
        var top = Math.max(0, (height - ascent - descent) / 2);
        return (height + capHeight) / 2 - (top + ascent);
    }

    // the cap height of the box's default font, as a fraction of its ascent
    function capRatio(g, box) {
        var styled = new AttributedString('H');
        box.defaultStyle.applyStyle(styled);
        var font = Font.getFont(styled.getIterator().getAttributes());
        var frc = g.getFontRenderContext();
        var cap = -font.createGlyphVector(frc, 'H').getVisualBounds().getY();
        return cap / font.getLineMetrics('H', frc).getAscent();
    }

    // Draws markup as one line, as drawAsSingleLine does in a middle-aligned
    // box, with its capitals centered vertically in the region.
    function drawCapCentered(g, box, text, region) {
        box.markupText = text;
        var segments = new ArrayList();
        box.appendSegments(
            g,
            new Rectangle(region.x, region.y, 1e6, 1e6),
            segments
        );
        var shift = 0;
        if (!segments.isEmpty()) {
            let first = segments.get(0);
            let ascent = first.getAscent();
            shift = capShift(
                region.height,
                capRatio(g, box) * ascent,
                ascent,
                first.getDescent()
            );
        }
        box.drawAsSingleLine(
            g,
            new Rectangle(
                region.x,
                region.y + shift,
                region.width,
                region.height
            )
        );
    }

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

    // tag + s, m or l at those sizes; the bare tag at size
    function setIconTags(box, tag, image, size) {
        box.setReplacementForTag(
            tag,
            '<image ' + image + ' ' + size + ' baseline>'
        );
        for (let suffix in IconSizes) {
            box.setReplacementForTag(
                tag + suffix,
                '<image ' + image + ' ' + IconSizes[suffix] + ' baseline>'
            );
        }
    }

    function inches(value) {
        return Number(value.toFixed(4)) + 'in';
    }

    // the width of the face's <name>-region (EncounterIcon or
    // ReturnEncounterIcon), else the medium icon size
    function headerIconSize(diy, face, name) {
        if (face == null) return IconSizes.m;
        var key = face.key(diy.settings, name + '-region');
        if (diy.settings.get(key) == null) return IconSizes.m;
        var width = diy.settings.getRegion2D(key).width;
        return inches(width / (face.dpi || 150));
    }

    // an arrow centered on baseline icons of size
    function arrowTag(size) {
        var top = (parseFloat(size) + ARROW_HEIGHT) / 2;
        return (
            '<image ' +
            ARROW +
            ' ' +
            ARROW_WIDTH +
            'in baseline ' +
            inches(top) +
            '>'
        );
    }

    function setUserIconTags(box, type, size) {
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
                '"' + settings.get('AHLCG-User' + type + 'Icon' + i) + '"',
                size
            );
        }
    }

    // tags for card text: symbols, styles, encounter and collection icons;
    // a bare icon tag matches the header icon of face, if given
    function initBodyTags(diy, box, face) {
        var settings = diy.settings;
        var o = plugin();
        var iconSize = headerIconSize(diy, face, 'EncounterIcon');
        var returnSize = headerIconSize(diy, face, 'ReturnEncounterIcon');

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
        box.setReplacementForTag(settings.get('Arrow-tag'), arrowTag(iconSize));

        for (let i = 0; i < o.standardEncounterList.length; i++) {
            let entry = o.standardEncounterList[i];
            if (isUsed('Encounter', entry[3])) {
                setIconTags(
                    box,
                    entry[2],
                    'res://ArkhamHorrorLCG/icons/AHLCG-' + entry[0] + '.png',
                    entry[0].substring(0, 6) === 'Return'
                        ? returnSize
                        : iconSize
                );
            }
        }
        setUserIconTags(box, 'Encounter', iconSize);

        for (let i = 0; i < o.standardCollectionList.length; i++) {
            let entry = o.standardCollectionList[i];
            if (isUsed('Collection', entry[2])) {
                setIconTags(
                    box,
                    entry[1],
                    'res://ArkhamHorrorLCG/icons/AHLCG-' + entry[0] + '.png',
                    iconSize
                );
            }
        }
        setUserIconTags(box, 'Collection', iconSize);

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
    // legacy cards save them. A face that fills flavor ends with a check
    // box for FillFlavor<face suffix>, which mentions victory text only when
    // the body draws it.
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

        if (face.fillsFlavor()) {
            let body = face.bodyParts || face.parts;
            let check = new ui.checkBox(
                strings.string(
                    body.indexOf('Victory') >= 0
                        ? 'AHLCG-FillFlavor'
                        : 'AHLCG-FillFlavorOnly'
                ),
                false
            );
            face.bindKey(
                bindings,
                faceIndex,
                'FillFlavor' + face.suffix(faceIndex),
                check
            );
            panel.place(check, 'skip, span, wrap');
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
    // [ alignment, start, end ] for parts other than the standard ones. pads
    // gives { before, after } points of space around parts, merged into the
    // spacing next to them where there is some.
    function partsMarkup(settings, parts, suffix, formats, pads) {
        var text = '';
        // where the space after the last part starts, and its points
        var spaceAt = -1;
        var space = 0;
        if (
            parts.indexOf('Traits') >= 0 &&
            String(settings.get('Traits' + suffix, '')) === ''
        )
            text = spacer(6);

        parts.forEach(function (part) {
            let entry = String(settings.get(part + suffix, ''));
            let pad = (entry !== '' && pads && pads[part]) || null;
            if (entry !== '') {
                let format = (formats && formats[part]) || PartFormats[part];
                if (pad != null && pad.before > 0) {
                    if (spaceAt >= 0)
                        text =
                            text.substring(0, spaceAt) +
                            '\n' +
                            spacer(space + pad.before);
                    else text += (text !== '' ? '\n' : '') + spacer(pad.before);
                }
                if (text !== '') text += '\n';
                text += format[0] + format[1] + entry + format[2];
            }
            spaceAt = -1;

            let after = pad != null ? pad.after : 0;
            let spacing = settings.get(part + suffix + 'Spacing');
            if (spacing == null) {
                if (after > 0) {
                    spaceAt = text.length;
                    space = after;
                    text += '\n' + spacer(after);
                }
                return;
            }
            spacing = Math.max(Number(spacing), 0);
            if (entry !== '') {
                spaceAt = text.length;
                space = (part === 'Traits' ? 0.5 : 1.5) + spacing + after;
                text += '\n' + spacer(space);
            } else if (spacing > 0) text += spacer(spacing);
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
        capShift: capShift,
        drawCapCentered: drawCapCentered,
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
