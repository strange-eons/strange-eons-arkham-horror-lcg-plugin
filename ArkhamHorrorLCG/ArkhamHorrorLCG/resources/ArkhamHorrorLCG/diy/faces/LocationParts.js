// Drawing shared by location faces and the cards that carry location stats:
// location and connection icons, shroud and clues. Regions are the face's
// own (face.key).
//
// Module: returns LocationParts.
define([
    'faces/FaceUtils',
    'faces/PlayerCard',
    'se/imageutils',
    'se/java',
], function (FaceUtils, PlayerCard, imageutils, Java) {
    const Color = Java.type('java.awt.Color');
    const Font = Java.type('java.awt.Font');
    const Light = new Color(0.996, 0.945, 0.859);
    const Dark = new Color(0, 0, 0);

    function region(face, diy, name) {
        return diy.settings.getRegion(face.key(diy.settings, name + '-region'));
    }

    function title(sheet, g, text, r, font, size, light, outline) {
        sheet.drawOutlinedTitle(
            g,
            text,
            r,
            font,
            size,
            outline || 0.8,
            light ? Light : Dark,
            light ? Dark : Light,
            0,
            true
        );
    }

    // name: LocationIcon or Connection<n>Icon. A back's 'Copy front' takes
    // the front's icon. base: paints the face's iconCircle under the icon.
    function paintIcon(face, g, diy, sheet, name, suffix, base) {
        if (base)
            sheet.paintImage(
                g,
                imageutils.ImageUtils.get(
                    'ArkhamHorrorLCG/overlays/' + face.iconCircle
                ),
                region(face, diy, 'BaseIcon')
            );
        var icon = diy.settings.get(name + suffix);
        if (icon != null && String(icon) === 'Copy front')
            icon = diy.settings.get(name);
        if (icon == null) return;
        icon = String(icon);
        // a front has nothing to copy
        if (icon === 'None' || icon === 'Empty' || icon === 'Copy front')
            return;
        sheet.paintImage(
            g,
            imageutils.ImageUtils.get(
                'ArkhamHorrorLCG/icons/AHLCG-Loc' + icon + '.png'
            ),
            region(face, diy, name)
        );
    }

    // whether name<suffix> shows an icon, a copied one when the front has one
    function hasIcon(diy, name, suffix) {
        var icon = String(diy.settings.get(name + suffix, 'None'));
        if (icon === 'Copy front')
            icon = String(diy.settings.get(name, 'None'));
        return icon !== 'None' && icon !== 'Copy front';
    }

    // shroud, light on dark; a per investigator one is followed by its symbol
    function paintShroud(face, g, diy, sheet, suffix) {
        var o = FaceUtils.plugin();
        var shroud = String(diy.settings.get('Shroud' + suffix, ''));
        var perInvestigator =
            String(diy.settings.get('ShroudPerInvestigator' + suffix)) === '1';
        var r = region(face, diy, 'Shroud');

        if (shroud === '1' || shroud === '4') r.x -= 2;
        else if (shroud === 'X') r.x -= 1;

        if (shroud === '-') {
            title(sheet, g, shroud, r, o.symbolFont, 12.0, true, 1.5);
        } else if (perInvestigator) {
            let value = region(face, diy, 'ShroudPerInv');
            let icon = region(face, diy, 'ShroudPerInvIcon');
            let size = 14.0;
            if (shroud === 'X') {
                value.x += 3;
                icon.x += 3;
            } else if (shroud === '1') icon.x -= 4;
            else if (shroud.length > 1) {
                icon.x += 2;
                size = 11.0;
            }
            if (shroud === 'Star') {
                value.x += 1;
                value.y += 2;
                icon.x -= 2;
                title(sheet, g, '*', value, o.chaosFont, 12.0, true);
            } else title(sheet, g, shroud, value, o.enemyFont, size, true);
            title(sheet, g, 'p', icon, o.symbolFont, 7.5, true);
        } else if (shroud === 'Star') {
            r.y += 2;
            title(sheet, g, '*', r, o.chaosFont, 12.0, true);
        } else title(sheet, g, shroud, r, o.enemyFont, 14.0, true);
    }

    // Clues, dark on light (light on dark for an act); a dash, a per
    // investigator value, or a value with an asterisk ($Asterisk<suffix>).
    // reverse: mirrors a region for a reversed card, or null.
    function paintClues(face, g, diy, sheet, suffix, act, reverse) {
        var o = FaceUtils.plugin();
        var clues = String(diy.settings.get('Clues' + suffix, ''));
        var perInvestigator =
            String(diy.settings.get('PerInvestigator' + suffix)) === '1';
        var asterisk = String(diy.settings.get('Asterisk' + suffix)) === '1';
        var symbolSize = act ? 6.0 : 7.5;
        var r = region(face, diy, 'Clues');
        if (reverse) r = reverse(r);

        if (clues === '-') {
            PlayerCard.paintDash(face, g, diy, sheet, r, 0, 6);
        } else if (perInvestigator) {
            let value = region(face, diy, 'CluesPerInv');
            let icon = region(face, diy, 'CluesPerInvIcon');
            if (reverse) {
                value = reverse(value);
                icon = reverse(icon);
                value.x = r.x + (r.x + r.width - (value.x + value.width));
                icon.x = r.x + (r.x + r.width - (icon.x + icon.width));
            }
            let size = 14.0;
            if (clues === 'X') {
                value.x += 3;
                icon.x += 3;
            } else if (clues === '1') icon.x -= 4;
            else if (clues.length > 1) {
                icon.x += 2;
                size = 11.0;
            }
            if (clues === 'Star') {
                value.x += 1;
                value.y += 2;
                icon.x -= 2;
                title(sheet, g, '*', value, o.chaosFont, 12.0, act);
            } else title(sheet, g, clues, value, o.enemyFont, size, act);
            title(sheet, g, 'p', icon, o.symbolFont, symbolSize, act);
        } else if (asterisk) {
            let size = 14.0;
            let dx = 7;
            let dy = 7;
            if (clues === 'Star' || clues === '1') dx = 4;
            else if (clues.length > 1) {
                r.x -= 1;
                dx = 6;
                size = 13.0;
            }
            r.x -= 4;
            if (clues === 'Star') {
                r.y += 2;
                title(sheet, g, '*', r, o.chaosFont, 12.0, act);
            } else title(sheet, g, clues, r, o.enemyFont, size, act);
            let font = new Font(o.bodyFamily, Font.ITALIC, 12.0);
            r.x += dx;
            r.y += dy;
            r.x +=
                clues === 'Star'
                    ? 6
                    : g.getFontMetrics(font).stringWidth(clues);
            title(sheet, g, '*', r, font, 12.0, act);
        } else if (clues === 'Star') {
            r.y += 2;
            title(sheet, g, '*', r, o.chaosFont, 12.0, act);
        } else title(sheet, g, clues, r, o.enemyFont, 14.0, act);
    }

    return {
        hasIcon: hasIcon,
        paintIcon: paintIcon,
        paintShroud: paintShroud,
        paintClues: paintClues,
    };
});
