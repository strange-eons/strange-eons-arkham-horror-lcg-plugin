// A campaign guide page (Guide75, GuideA4 or GuideLetter): its template, two
// portraits placed by position and faded at their edges by a stencil, the
// left and right text regions the portraits leave, and the page number.
//
// Settings: PageType is Title, Empty (a page, mirrored when even) or
// another template; Page; PositionPortrait1 and PositionPortrait2.
//
// Module: returns { paintTemplate, paintPortraits, portraitRegion,
// setStencil, setupPortrait, bodyRegions, paintPageNumber, initTags }.
define([
    'core/PluginInfo',
    'faces/FaceUtils',
    'legacy/ImageFilters',
    'se/common',
    'se/imageutils',
    'se/java',
    'se/strings',
], function (
    PluginInfo,
    FaceUtils,
    ImageFilters,
    common,
    imageutils,
    Java,
    strings
) {
    const AlphaComposite = Java.type('java.awt.AlphaComposite');
    const Color = Java.type('java.awt.Color');
    const Point2D = Java.type('java.awt.geom.Point2D');
    const ImageUtilities = Java.type('ca.cgjennings.graphics.ImageUtilities');
    const FACE_FRONT = 0;
    // where each page size places a title page's header for a language
    const TitleHeaders = {
        Guide75: {
            fr: [187, 51, 750, 188],
            it: [172, 147, 783, 90],
            de: [172, 147, 783, 94],
        },
        GuideA4: {
            fr: [206, 56, 827, 207],
            it: [189, 162, 865, 99],
            de: [190, 162, 863, 104],
        },
        GuideLetter: {
            fr: [223, 56, 827, 207],
            it: [206, 162, 865, 99],
            de: [207, 162, 863, 104],
        },
    };

    function pageType(card) {
        return card.get('PageType');
    }

    // The image for the page's template, AHLCG-<type><page>-template; an
    // even empty page mirrors it. A high resolution render uses the
    // <key>-hires image where installed, and for an even empty page the
    // AHLCG-<type>EmptyEven-template-hires image, which is already mirrored.
    function templateImage(card, diy, sheet, type, page) {
        var ImageUtils = imageutils.ImageUtils;
        var key = 'AHLCG-' + type + page + '-template';
        var even = page === 'Empty' && Number(card.get('Page')) % 2 === 0;
        var hires = sheet.isHighResolutionRendering();
        if (hires && even) {
            var evenPath = diy.settings.get(
                'AHLCG-' + type + 'EmptyEven-template-hires'
            );
            if (evenPath != null) return ImageUtils.get(evenPath);
        }
        var path = hires ? diy.settings.get(key + '-hires') : null;
        var image = ImageUtils.get(path != null ? path : diy.settings.get(key));
        return even ? ImageUtils.mirror(image, true, false) : image;
    }

    // the page's template, with a title page's translated header and label
    function paintTemplate(card, g, diy, sheet, labelBox) {
        var ImageUtils = imageutils.ImageUtils;
        var type = card.type(sheet.getSheetIndex());
        var page = pageType(card);
        var base = ImageUtils.get(
            diy.settings.get('AHLCG-' + type + page + '-template')
        );
        var region = new common.Region(0, 0, base.getWidth(), base.getHeight());
        sheet.paintImage(
            g,
            templateImage(card, diy, sheet, type, page),
            region
        );
        if (page !== 'Title') return;

        var locale = String(PluginInfo.locale());
        var header = TitleHeaders[type][locale];
        if (header)
            sheet.paintImage(
                g,
                ImageUtils.get(
                    'ArkhamHorrorLCG/overlays/AHLCG-Guide75Title-' +
                        locale +
                        '.png'
                ),
                new common.Region(header[0], header[1], header[2], header[3])
            );
        labelBox.markupText = strings.gstring('AHLCG-Label-CampaignGuide');
        labelBox.drawAsSingleLine(
            g,
            diy.settings.getRegion(card.key(FACE_FRONT, 'Label-region'))
        );
    }

    // each portrait with a stencil, through it, over the body region
    function paintPortraits(card, g, diy, sheet) {
        var bodyRegion = diy.settings.getRegion(
            card.key(FACE_FRONT, 'Body-region')
        );
        card.portraits.forEach(function (portrait) {
            var stencil = portrait.getClipStencil();
            if (stencil == null) return;
            var image = portrait.getImage();
            var scale = portrait.getScale();
            var through = ImageFilters.alphaInverted(stencil);
            var gs = through.getGraphics();
            gs.setComposite(AlphaComposite.SrcIn);
            gs.drawImage(
                image,
                stencil.getWidth() / 2 -
                    (image.getWidth() * scale) / 2 +
                    portrait.getPanX(),
                stencil.getHeight() / 2 -
                    (image.getHeight() * scale) / 2 +
                    portrait.getPanY(),
                image.getWidth() * scale,
                image.getHeight() * scale,
                null
            );
            gs.dispose();
            sheet.paintImage(g, through, bodyRegion);
        });
    }

    // The page's measures: its width and height, the height of its text, the
    // height of a third (on a title page, a half) of the text and the width
    // of a column.
    function measures(card, diy, page) {
        var body = diy.settings.getRegion(card.key(FACE_FRONT, 'Body-region'));
        var text = diy.settings.getRegion(
            card.key(FACE_FRONT, 'BodyLeft' + page + '-region')
        ).height;
        return {
            width: body.width,
            height: body.height,
            text: text,
            box: text / (page === 'Title' ? 2 : 3),
            column: body.width / 2,
        };
    }

    // The rectangles [ x, y, width, height ] a position covers, from top,
    // the top of the text. A corner covers two boxes down one side and the
    // box beside them.
    function areas(position, m, top) {
        var right = m.width - m.column;
        var half = m.text / 2;
        var lowBox = m.height - m.box;
        var lowHalf = m.height - half;
        var lowTwo = m.height - m.box * 2;
        return {
            TopLeftSmall: [[0, top, m.column, m.box]],
            TopLeftMedium: [[0, top, m.column, half]],
            BottomLeftSmall: [[0, lowBox, m.column, m.box]],
            BottomLeftMedium: [[0, lowHalf, m.column, half]],
            TopRightSmall: [[right, top, m.column, m.box]],
            TopRightMedium: [[right, top, m.column, half]],
            BottomRightSmall: [[right, lowBox, m.column, m.box]],
            BottomRightMedium: [[right, lowHalf, m.column, half]],
            TopLarge: [[0, top, m.width, m.box]],
            TopHalf: [[0, top, m.width, half]],
            BottomLarge: [[0, lowBox, m.width, m.box]],
            BottomHalf: [[0, lowHalf, m.width, half]],
            LeftLarge: [[0, top, m.column, m.text]],
            RightLarge: [[right, top, m.column, m.text]],
            TopLeftCorner: [
                [0, top, m.width, m.box],
                [0, top, m.column, m.box * 2],
            ],
            BottomLeftCorner: [
                [0, lowBox, m.width, m.box],
                [0, lowTwo, m.column, m.box * 2],
            ],
            TopRightCorner: [
                [0, top, m.width, m.box],
                [right, top, m.column, m.box * 2],
            ],
            BottomRightCorner: [
                [0, lowBox, m.width, m.box],
                [right, lowTwo, m.column, m.box * 2],
            ],
            FullPage: [[0, top, m.width, m.text]],
        }[position];
    }

    // the region a position covers, or null for none; a corner covers the
    // full width of its two boxes
    function portraitRegion(card, diy, position) {
        var m = measures(card, diy, pageType(card));
        var found = areas(String(position), m, m.height - m.text);
        if (found == null) return null;
        var r = found[0];
        if (found.length > 1) r = [r[0], found[1][1], r[2], found[1][3]];
        return new common.Region(r[0], r[1], r[2], r[3]);
    }

    // A stencil hiding all but the position's area, its rounded corners
    // blurred; a title page's text starts below its title.
    function setStencil(card, diy, portrait, position, page) {
        var inset = 30; // blurring is clipped otherwise
        page = String(page);
        var m = measures(card, diy, page);
        var top = 0;
        if (page === 'Title') top = card.type(0) === 'Guide75' ? 313 : 352;

        var stencil = imageutils.ImageUtils.create(m.width, m.height, true);
        var g = stencil.getGraphics();
        g.setColor(new Color(0, 0, 0, 1.0));
        g.fillRect(0, 0, m.width, m.height);
        g.setComposite(AlphaComposite.Src);
        g.setColor(new Color(0, 0, 0, 0.0));
        (areas(String(position), m, top) || []).forEach(function (r) {
            g.fillRoundRect(
                r[0] + inset,
                r[1] + inset,
                r[2] - inset * 2,
                r[3] - inset * 2,
                75,
                75
            );
        });
        g.dispose();
        portrait.setClipStencil(ImageFilters.blurred(stencil));
    }

    // Updates a portrait's stencil for its position; with no position, it is
    // reset to the page's origin. When placing, it covers the position's
    // region, centered.
    function setupPortrait(card, diy, portraitIndex, position, placing) {
        var portrait = card.portraits[portraitIndex];
        try {
            let region = portraitRegion(card, diy, position);
            if (region == null) {
                portrait.pan = new Point2D.Float(0, 0);
                portrait.scale = 1.0;
            } else if (placing) {
                let image = portrait.image;
                let clip = portrait.getClipDimensions();
                portrait.pan = new Point2D.Float(
                    region.x + (region.width - clip.width) / 2,
                    region.y + (region.height - clip.height) / 2
                );
                portrait.scale = ImageUtilities.idealCoveringScaleForImage(
                    region.width,
                    region.height,
                    image.getWidth(),
                    image.getHeight()
                );
            }
            setStencil(card, diy, portrait, position, pageType(card));
        } catch (ex) {
            Error.handleUncaught(ex);
        }
    }

    // How far each portrait position pushes the left and right text down
    // from the top and up from the bottom of the text, as
    // [ leftDown, rightDown, leftUp, rightUp ] in boxes, halves or the text.
    function reach(position, box, half, text) {
        return {
            TopLeftSmall: [box, 0, 0, 0],
            TopLeftMedium: [half, 0, 0, 0],
            BottomLeftSmall: [0, 0, box, 0],
            BottomLeftMedium: [0, 0, half, 0],
            TopRightSmall: [0, box, 0, 0],
            TopRightMedium: [0, half, 0, 0],
            BottomRightSmall: [0, 0, 0, box],
            BottomRightMedium: [0, 0, 0, half],
            TopLarge: [box, box, 0, 0],
            TopHalf: [half, half, 0, 0],
            BottomLarge: [0, 0, box, box],
            BottomHalf: [0, 0, half, half],
            TopLeftCorner: [box * 2, box, 0, 0],
            BottomLeftCorner: [0, 0, box * 2, box],
            TopRightCorner: [box, box * 2, 0, 0],
            BottomRightCorner: [0, 0, box, box * 2],
            Full: [text, text, 0, 0],
        }[position];
    }

    // the left and right text regions, less what the portraits cover
    function bodyRegions(card, regions) {
        var page = pageType(card);
        var a4 = card.type(0) === 'GuideA4';
        var text = 995;
        var divisions = 3;
        var spacer = 15;
        if (page === 'Title') {
            text = 682;
            if (a4) {
                text = 1272;
                spacer = -15;
            }
            divisions = 2;
        } else if (a4) {
            text = 1559;
            spacer = -15;
        }

        var box = text / divisions;
        var down = [0, 0];
        var up = [0, 0];
        for (let index = 1; index <= 2; index++) {
            let r = reach(
                String(card.get('PositionPortrait' + index)),
                box,
                text / 2,
                text
            );
            if (r == null) continue;
            down = [Math.max(down[0], r[0]), Math.max(down[1], r[1])];
            up = [Math.max(up[0], r[2]), Math.max(up[1], r[3])];
        }

        [0, 1].forEach(function (side) {
            if (down[side] > spacer) {
                regions[side].y += down[side] - spacer;
                regions[side].height -= down[side] - spacer;
            }
            // a little extra room avoids needless overflow boxes
            if (up[side] > spacer)
                regions[side].height -= up[side] - spacer - 30;
        });
        return regions;
    }

    // the page number, on the outer edge of an odd or even page
    function paintPageNumber(card, g, diy, sheet, box) {
        var faceIndex = sheet.getSheetIndex();
        var parity = Number(card.get('Page')) % 2 === 0 ? 'Even' : 'Odd';
        var region = diy.settings.getRegion(
            card.key(faceIndex, 'Page' + parity + '-region')
        );
        if (!region) return;
        box.markupText = card.settings.get('Page' + card.suffix(faceIndex));
        box.drawAsSingleLine(g, region);
    }

    // the guide's text styles
    function initTags(diy, box) {
        FaceUtils.plugin().GuideStyleList.forEach(function (item) {
            box.setStyleForTag(
                diy.settings.get(item + '-tag'),
                diy.settings.getTextStyle(item + '-style', null)
            );
        });
    }

    return {
        paintTemplate: paintTemplate,
        paintPortraits: paintPortraits,
        portraitRegion: portraitRegion,
        setStencil: setStencil,
        setupPortrait: setupPortrait,
        bodyRegions: bodyRegions,
        paintPageNumber: paintPageNumber,
        initTags: initTags,
    };
});
