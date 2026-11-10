// Legacy template images: clearing the sheet, the template for the card type
// or back, and an image the user chose to replace it.
//
// Settings: AHLCG-<name>-template is a template image, with a
// <key>-hires version where installed; TemplateReplacement[Back] holds a
// replacement image, covering the bleed when TemplateReplacementBleed is 1.
//
// Module: returns { clear, templateKey, paintFullBleed, paintFront,
// paintBack, usesReplacement }.
define([
    'core/UserImages',
    'faces/FaceUtils',
    'se/common',
    'se/java',
], function (UserImages, FaceUtils, common, Java) {
    const Color = Java.type('java.awt.Color');
    const FACE_FRONT = 0;

    // fills the sheet with opaque black, then translates g to the trim edge
    function clear(g, sheet) {
        var paint = g.getPaint();
        g.setPaint(Color.BLACK);
        g.fillRect(0, 0, sheet.getTemplateWidth(), sheet.getTemplateHeight());
        g.setPaint(paint);
        FaceUtils.translateToTrim(g, sheet);
    }

    function templateKey(name) {
        return 'AHLCG-' + name + '-template';
    }

    // the template key for the image path a face template setting holds
    function templateKeyForSetting(card, setting) {
        return FaceUtils.plugin().templateKeys[card.get(setting)] || setting;
    }

    // The image set by key, over the whole sheet with its bleed; when
    // rendering for export or printing, the <key>-hires image if installed.
    // g is translated to the trim edge.
    function paintFullBleed(card, g, sheet, key) {
        if (card.get(key) == null) {
            common.Eons.log.warning('missing template setting: ' + key);
            return;
        }
        var bleed = FaceUtils.bleedPixels(sheet);
        sheet.paintImage(g, key, -bleed, -bleed);
    }

    function replacementKey(faceIndex) {
        return 'TemplateReplacement' + (faceIndex === FACE_FRONT ? '' : 'Back');
    }

    function usesReplacement(card, faceIndex) {
        var replacement = card.get(replacementKey(faceIndex));
        return replacement != null && replacement.length > 0;
    }

    // the replacement image, over the trim unless it includes the bleed
    function paintReplacement(card, g, sheet, faceIndex) {
        try {
            let image = UserImages.read(card.get(replacementKey(faceIndex)));
            if (!image) return;
            let bleed = FaceUtils.bleedPixels(sheet);
            let region = new common.Region(
                0,
                0,
                sheet.getTemplateWidth() - 2 * bleed,
                sheet.getTemplateHeight() - 2 * bleed
            );
            if (card.get('TemplateReplacementBleed') === '1')
                region = new common.Region(
                    -bleed,
                    -bleed,
                    sheet.getTemplateWidth(),
                    sheet.getTemplateHeight()
                );
            sheet.paintImage(g, image, region);
        } catch (ex) {
            common.Eons.log.warning('Error reading image file.');
        }
    }

    // the replacement, or the card type's template, or its Decoy or
    // NamedDecoy version as $Template chooses
    function paintFront(card, g, sheet) {
        var faceIndex = sheet.getSheetIndex();
        if (usesReplacement(card, faceIndex)) {
            paintReplacement(card, g, sheet, faceIndex);
            return;
        }
        var name = card.type(faceIndex);
        var template = card.get('Template');
        if (template === 'Decoy' || template === 'NamedDecoy') name += template;
        paintFullBleed(card, g, sheet, templateKey(name));
    }

    // the replacement, or the player or encounter back, or the face's
    // default template
    function paintBack(card, g, sheet, backType) {
        var faceIndex = sheet.getSheetIndex();
        if (usesReplacement(card, faceIndex)) {
            paintReplacement(card, g, sheet, faceIndex);
            return;
        }
        var key;
        if (backType === 'Player') key = templateKey('PlayerBack');
        else if (backType === 'Encounter') key = templateKey('EncounterBack');
        else
            key = templateKeyForSetting(
                card,
                card.key(faceIndex, 'Default-template')
            );
        paintFullBleed(card, g, sheet, key);
    }

    return {
        clear: clear,
        templateKey: templateKey,
        paintFullBleed: paintFullBleed,
        paintFront: paintFront,
        paintBack: paintBack,
        usesReplacement: usesReplacement,
    };
});
