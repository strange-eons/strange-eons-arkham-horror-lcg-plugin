// Paints card art portraits. With mirrored edges, image edges that stop just
// short of the clip region are extended to it by mirroring the image across
// them.
//
// Module: returns PortraitArt.
define(['faces/FaceUtils', 'se/common', 'se/imageutils', 'se/java'], function (
    FaceUtils,
    common,
    imageutils,
    Java
) {
    const AffineTransform = Java.type('java.awt.geom.AffineTransform');
    const AlphaComposite = Java.type('java.awt.AlphaComposite');
    const Color = Java.type('java.awt.Color');
    // Source pixels to add on each side of an image whose scaled bounds
    // (x, y, w, h) stop short of the clip region by no more than the bleed
    // margin (within a pixel), or null if no edge qualifies.
    function bleedPadding(x, y, w, h, clip, bleed, sx, sy) {
        var reach = bleed + 1;
        var pad = { left: 0, top: 0, right: 0, bottom: 0 };
        var left = x - clip.x;
        var top = y - clip.y;
        var right = clip.x + clip.width - (x + w);
        var bottom = clip.y + clip.height - (y + h);

        if (left > 0 && left <= reach) pad.left = Math.ceil(left / sx);
        if (top > 0 && top <= reach) pad.top = Math.ceil(top / sy);
        if (right > 0 && right <= reach) pad.right = Math.ceil(right / sx);
        if (bottom > 0 && bottom <= reach) pad.bottom = Math.ceil(bottom / sy);

        if (pad.left + pad.top + pad.right + pad.bottom === 0) return null;
        return pad;
    }

    // a copy of image extended outward by pad pixels on each side, mirroring
    // the image across its edges
    function mirrorEdges(image, pad) {
        var w = image.getWidth();
        var h = image.getHeight();
        var result = imageutils.ImageUtils.create(
            w + pad.left + pad.right,
            h + pad.top + pad.bottom,
            true
        );
        var g = result.createGraphics();
        try {
            let l = pad.left,
                t = pad.top,
                r = l + w,
                b = t + h;
            let R = result.getWidth(),
                B = result.getHeight();

            // source span next to each edge: as much image as the mirror
            // fills, up to all of it
            let sl = Math.min(l, w);
            let sr = Math.min(R - r, w);
            let st = Math.min(t, h);
            let sb = Math.min(B - b, h);

            g.drawImage(image, l, t, null);
            // edges; reversed source coordinates flip the image
            g.drawImage(image, 0, t, l, b, sl, 0, 0, h, null);
            g.drawImage(image, r, t, R, b, w, 0, w - sr, h, null);
            g.drawImage(image, l, 0, r, t, 0, st, w, 0, null);
            g.drawImage(image, l, b, r, B, 0, h, w, h - sb, null);
            // corners
            g.drawImage(image, 0, 0, l, t, sl, st, 0, 0, null);
            g.drawImage(image, r, 0, R, t, w, st, w - sr, 0, null);
            g.drawImage(image, 0, b, l, B, sl, h, 0, h - sb, null);
            g.drawImage(image, r, b, R, B, w, h, w - sr, h - sb, null);
        } finally {
            g.dispose();
        }
        return result;
    }

    // The portrait's <key>-MirrorEdges: Enable, Disable, or Default for the
    // Mirror edges portrait bleed preference.
    function mirrorsEdges(diy, portrait) {
        var mode = String(
            diy.settings.get(portrait.getBaseKey() + '-MirrorEdges', 'Default')
        );
        if (mode === 'Enable') return true;
        if (mode === 'Disable') return false;
        return (
            String(
                common.Settings.getUser().get('AHLCG-PortraitBleed', 'None')
            ) === 'MirrorEdges'
        );
    }

    // g is translated to the trim edge, as the clip region is
    function paint(g, diy, sheet, portrait) {
        var image = portrait.getImage();
        var bleed = FaceUtils.bleedPixels(sheet);
        var mirror = mirrorsEdges(diy, portrait);

        if (!mirror || bleed === 0 || image == null || portrait.getRotation()) {
            portrait.paint(g, sheet.getRenderTarget());
            return;
        }

        var clip = diy.settings.getRegion(
            portrait.getBaseKey() + '-portrait-clip'
        );
        var scale = portrait.getScale();

        // image bounds as DefaultPortrait paints them
        var w = Math.floor(image.getWidth() * scale + 0.5);
        var h = Math.floor(image.getHeight() * scale + 0.5);
        var x = Math.floor(
            clip.getCenterX() -
                (image.getWidth() * scale) / 2 +
                portrait.getPanX()
        );
        var y = Math.floor(
            clip.getCenterY() -
                (image.getHeight() * scale) / 2 +
                portrait.getPanY()
        );
        var sx = w / image.getWidth();
        var sy = h / image.getHeight();

        var pad = bleedPadding(x, y, w, h, clip, bleed, sx, sy);
        if (pad == null) {
            portrait.paint(g, sheet.getRenderTarget());
            return;
        }

        var extended = mirrorEdges(image, pad);
        var oldClip = g.getClip();
        if (portrait.getClipping()) g.clip(clip);
        if (portrait.isBackgroundFilled()) {
            g.setPaint(Color.WHITE);
            g.fillRect(clip.x, clip.y, clip.width, clip.height);
        }
        var transform = AffineTransform.getTranslateInstance(
            x - pad.left * sx,
            y - pad.top * sy
        );
        transform.scale(sx, sy);
        g.drawImage(extended, transform, null);
        g.setClip(oldClip);
    }

    // The art inside the clip region (the bleed region, with bleed) through
    // the overlays/AHLCG-<mask>Mask.png stencil, as an investigator's faded
    // art; the portrait's rotation is ignored.
    function paintFaded(g, diy, sheet, portrait, mask) {
        var ImageUtils = imageutils.ImageUtils;
        var image = portrait.getImage();
        var scale = portrait.getScale();
        var base = portrait.getBaseKey();
        var clip = diy.settings.getRegion(base + '-portrait-clip');
        var area = clip;
        if (FaceUtils.bleedPixels(sheet) > 0)
            area = diy.settings.getRegion(base + '-portrait-bleed') || clip;

        var cx = image.getWidth() / 2 - portrait.getPanX();
        var cy = image.getHeight() / 2 - portrait.getPanY();
        var cropped = ImageUtils.crop(
            image,
            cx - (clip.getCenterX() - area.x) / scale,
            cy - (clip.getCenterY() - area.y) / scale,
            area.width / scale,
            area.height / scale
        );

        var stencil = ImageUtils.resize(
            ImageUtils.get(
                'ArkhamHorrorLCG/overlays/AHLCG-' + mask + 'Mask.png'
            ),
            cropped.width,
            cropped.height
        );
        var faded = ImageUtils.create(cropped.width, cropped.height, true);
        var fg = faded.createGraphics();
        fg.drawImage(stencil, 0, 0, null);
        fg.setComposite(AlphaComposite.SrcIn);
        fg.drawImage(cropped, 0, 0, null);
        fg.dispose();

        sheet.paintImage(g, faded, area);
    }

    return { paint: paint, paintFaded: paintFaded };
});
