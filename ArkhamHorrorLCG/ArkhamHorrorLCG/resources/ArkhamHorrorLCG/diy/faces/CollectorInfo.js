// The collector line, drawn right to left: collection number and icon, then
// encounter number; the copyright and artist, in their own regions; and the
// encounter icon, in the face's own place.
//
// Face settings: CollectionNumber, EncounterNumber, Copyright, Artist
// (-region, boxes), CollectionIcon-region, EncounterIcon-region and
// ReturnEncounterIcon-region.
//
// Module: returns CollectorInfo.
define(['faces/FaceUtils', 'se/imageutils', 'se/strings', 'se/java'], function (
    FaceUtils,
    imageutils,
    strings,
    Java
) {
    const AlphaComposite = Java.type('java.awt.AlphaComposite');
    const AffineTransform = Java.type('java.awt.geom.AffineTransform');
    const InversionFilter = Java.type(
        'ca.cgjennings.graphics.filters.InversionFilter'
    );
    const RenderingHints = Java.type('java.awt.RenderingHints');
    const StrangeImage = Java.type('resources.StrangeImage');
    const Sides = ['Front', 'Back'];
    const ENCOUNTER_CLIP_KEY = 'AHLCG-Face-Encounter-portrait-clip-region';

    // a built-in set icon: a vector image trimmed to its artwork
    function setIcon(name) {
        return StrangeImage.get(
            'res://ArkhamHorrorLCG/icons/AHLCG-' + name + '.svg'
        );
    }

    // the pixel size g draws region with, at least the region's own
    function pixelSize(g, region) {
        var scale = Math.max(Math.abs(g.getTransform().getScaleX()), 1);
        return {
            width: Math.max(1, Math.ceil(region.width * scale)),
            height: Math.max(1, Math.ceil(region.height * scale)),
        };
    }

    // the part of a width x height box that an image fits, centered
    function fitBox(image, x, y, width, height) {
        var scale = Math.min(
            width / image.getWidth(),
            height / image.getHeight()
        );
        var w = image.getWidth() * scale;
        var h = image.getHeight() * scale;
        return {
            x: x + (width - w) / 2,
            y: y + (height - h) / 2,
            width: w,
            height: h,
        };
    }

    // an image fit whole and centered in a new width x height bitmap
    function fitImage(image, width, height) {
        var out = imageutils.ImageUtils.create(width, height, true);
        var g = out.createGraphics();
        try {
            g.setRenderingHint(
                RenderingHints.KEY_INTERPOLATION,
                RenderingHints.VALUE_INTERPOLATION_BICUBIC
            );
            let box = fitBox(image, 0, 0, width, height);
            g.drawImage(
                image,
                Math.round(box.x),
                Math.round(box.y),
                Math.round(box.width),
                Math.round(box.height),
                null
            );
        } finally {
            g.dispose();
        }
        return out;
    }

    // a set icon as a bitmap with the pixels g draws region with, fit and
    // centered
    function setIconBitmap(g, name, region) {
        var size = pixelSize(g, region);
        return setIcon(name).toBufferedImage(size.width, size.height, true);
    }

    function inverted(image) {
        return new InversionFilter().filter(image, null);
    }

    // the region, moved left to end at x if it would otherwise pass it
    function endAt(region, x) {
        if (x - region.width < region.x) region.x = x - region.width;
        return region;
    }

    // Light collector text would vanish on ink saver's white sheet. The sheet
    // can switch modes after its boxes are made, so this is set for each paint.
    function setText(box, sheet, text) {
        box.markupText = sheet.isPrototypeRenderingModeEnabled()
            ? '<color #000000>' + text + '</color>'
            : text;
    }

    // returns the left edge of the number
    function paintCollectionNumber(g, diy, sheet, face, box, suffix, x) {
        var faceIndex = sheet.getSheetIndex();
        var number = String(diy.settings.get('CollectionNumber', ''));
        if (number === '') return x;

        var region = face.collectorRegion(diy, 'CollectionNumber');
        region.y += parseInt(FaceUtils.plugin().collectionFontOffset);

        if (suffix) {
            let flip = String(diy.settings.get('flipSuffix', '0')) === '1';
            number += (faceIndex === 0) !== flip ? 'a' : 'b';
        }
        setText(box, sheet, number);

        return region.x + region.width - box.drawAsSingleLine(g, region);
    }

    // returns the left edge of the icon
    function paintCollectionIcon(diy, g, sheet, face, portrait, x) {
        var region = endAt(face.collectorRegion(diy, 'CollectionIcon'), x);
        var icon;
        if (String(diy.settings.get('CollectionType', '0')) === '0')
            icon = setIconBitmap(g, diy.settings.get('Collection'), region);
        else {
            let size = pixelSize(g, region);
            icon = fitImage(portrait.getImage(), size.width, size.height);
        }
        sheet.paintImage(
            g,
            face.invertCollectionIcon ? inverted(icon) : icon,
            region
        );
        return region.x;
    }

    function paintEncounterNumber(g, diy, sheet, face, box, x) {
        var number = String(diy.settings.get('EncounterNumber', ''));
        var total = String(diy.settings.get('EncounterTotal', ''));
        if (number === '' && total === '') return;

        var region = endAt(face.collectorRegion(diy, 'EncounterNumber'), x);
        region.y += parseInt(FaceUtils.plugin().collectionFontOffset);

        var separator = ' / ';
        if (face.compactEncounterTotal) separator = '/';
        else if (FaceUtils.plugin().OS === 'Mac') separator = '\u200a/\u200a';
        setText(box, sheet, number + separator + total);
        box.drawAsSingleLine(g, region);
    }

    function paintCopyright(g, diy, sheet, face, box) {
        var region = face.collectorRegion(diy, 'Copyright');
        var o = FaceUtils.plugin();
        region.y += parseInt(o.collectionFontOffset);
        if (String(o.bodyFamily) === 'Times New Roman') region.y -= 1;

        setText(box, sheet, String(diy.settings.get('Copyright', '')));
        box.drawAsSingleLine(g, region);
    }

    // the icon cut out of the return-to disc
    function returnToImage(icon) {
        var ImageUtils = imageutils.ImageUtils;
        var image = ImageUtils.create(36, 33, true);
        var g = image.createGraphics();
        try {
            g.drawImage(
                ImageUtils.get(
                    'ArkhamHorrorLCG/overlays/AHLCG-ReturnToBase.png'
                ),
                0,
                0,
                null
            );
            g.setComposite(AlphaComposite.DstOut);
            g.drawImage(fitImage(icon, 28, 28), 4, 4, null);
        } finally {
            g.dispose();
        }
        return image;
    }

    // the icon of the set a return-to set returns to
    var ReturnedIcons = {
        ExtracurricularActivities: 'ExtracurricularActivity',
        TheRainforest: 'Rainforest',
    };

    // the image scaled into a region that may have fractional bounds
    function paintIcon(g, image, region) {
        var t = AffineTransform.getTranslateInstance(region.x, region.y);
        t.scale(
            region.width / image.getWidth(),
            region.height / image.getHeight()
        );
        g.drawImage(image, t, null);
    }

    // The custom icon portrait, placed in its clip region, drawn scaled from
    // the clip to fit region, centered, keeping its proportions. Settings
    // can't change while a sheet paints; the handler keeps the clip in step
    // with the faces.
    function paintCustomEncounterIcon(g, diy, sheet, portrait, region) {
        var clip = diy.settings.getRegion(ENCOUNTER_CLIP_KEY);
        var box = fitBox(clip, region.x, region.y, region.width, region.height);
        var saved = g.getTransform();
        try {
            g.translate(box.x, box.y);
            g.scale(box.width / clip.width, box.height / clip.height);
            g.translate(-clip.x, -clip.y);
            portrait.paint(g, sheet.getRenderTarget());
        } finally {
            g.setTransform(saved);
        }
    }

    function paintEncounterIcon(g, diy, sheet, face, portrait) {
        var settings = diy.settings;
        var name = String(settings.get('Encounter', ''));
        var custom = String(settings.get('EncounterType', '0')) !== '0';

        if (name.substring(0, 6) === 'Return' && face.fillReturnEncounterIcon) {
            let returned = name.substring(8);
            let icon = custom
                ? portrait.getImage()
                : setIcon(ReturnedIcons[returned] || returned).toBufferedImage(
                      28,
                      28,
                      true
                  );
            paintIcon(
                g,
                returnToImage(icon),
                face.collectorRegion(diy, 'ReturnEncounterIcon', true)
            );
            return;
        }

        if (name.substring(0, 6) === 'Return') {
            setIcon(name).paint(
                g,
                face.collectorRegion(diy, 'ReturnEncounterIcon', true),
                true
            );
            return;
        }

        if (!custom) {
            setIcon(name).paint(
                g,
                face.collectorRegion(diy, 'EncounterIcon', true),
                true
            );
        } else {
            paintCustomEncounterIcon(
                g,
                diy,
                sheet,
                portrait,
                face.collectorRegion(diy, 'EncounterIcon', true)
            );
        }
    }

    // the face's $Artist<suffix>, if any
    function paintArtist(g, diy, sheet, face, box) {
        var suffix = face.suffix(sheet.getSheetIndex());
        var artist = String(diy.settings.get('Artist' + suffix, ''));
        // a back showing the front's art credits the front's artist
        if (
            artist.length === 0 &&
            suffix !== '' &&
            String(diy.settings.get('PortraitShare', '0')) === '1'
        )
            artist = String(diy.settings.get('Artist', ''));
        if (artist.length === 0) return;

        var region = face.collectorRegion(diy, 'Artist');
        region.y += parseInt(FaceUtils.plugin().collectionFontOffset);

        setText(
            box,
            sheet,
            strings.gstring('AHLCG-IllustratorShort') + ' ' + artist
        );
        box.drawAsSingleLine(g, region);
    }

    // collector: { collection, encounter, suffix }, the card's portraits and
    // whether the collection number takes a side suffix; encounterNumber is
    // false for a face that leaves out the encounter number
    function paint(
        g,
        diy,
        sheet,
        face,
        boxes,
        collector,
        encounterIcon,
        encounterNumber
    ) {
        var faceIndex = sheet.getSheetIndex();
        var side = Sides[faceIndex];
        var x = sheet.getTemplateWidth() - 2 * FaceUtils.bleedPixels(sheet);

        if (
            String(diy.settings.get('ShowCollectionNumber' + side, '1')) === '1'
        ) {
            x =
                paintCollectionNumber(
                    g,
                    diy,
                    sheet,
                    face,
                    boxes.collectionNumber,
                    collector.suffix,
                    x
                ) - 3;
            x =
                paintCollectionIcon(
                    diy,
                    g,
                    sheet,
                    face,
                    collector.collection,
                    x
                ) - 11;
        } else x -= 21;

        if (encounterIcon)
            paintEncounterIcon(g, diy, sheet, face, collector.encounter);

        if (
            encounterNumber !== false &&
            String(diy.settings.get('ShowEncounterNumber' + side, '1')) === '1'
        ) {
            paintEncounterNumber(g, diy, sheet, face, boxes.encounterNumber, x);
        }

        if (String(diy.settings.get('ShowCopyright' + side, '1')) === '1') {
            paintCopyright(g, diy, sheet, face, boxes.copyright);
        }
    }

    // the copyright alone, for a face without the rest of the collector line
    function paintCopyrightOnly(g, diy, sheet, face, box) {
        var side = Sides[sheet.getSheetIndex()];
        if (String(diy.settings.get('ShowCopyright' + side, '1')) === '1')
            paintCopyright(g, diy, sheet, face, box);
    }

    // the collection icon alone, in its region
    function paintCollectionIconOnly(g, diy, sheet, face, collector) {
        paintCollectionIcon(
            diy,
            g,
            sheet,
            face,
            collector.collection,
            Number.MAX_VALUE
        );
    }

    function paintEncounterIconOnly(g, diy, sheet, face, collector) {
        paintEncounterIcon(g, diy, sheet, face, collector.encounter);
    }

    return {
        paint: paint,
        paintCollectionIcon: paintCollectionIconOnly,
        paintEncounterIcon: paintEncounterIconOnly,
        paintArtist: paintArtist,
        paintCopyright: paintCopyrightOnly,
    };
});
