// A run of token blocks: text beside one or more chaos token icons. Each block
// is a group; a group of several icons has lines between icons and text.
//
// Groups are spaced evenly when they fit, around a center-ish point when they
// are short. Otherwise they stack from the top, shrinking in 5% steps.
//
// Module: returns TokenBlocks.
define([
    'faces/FaceUtils',
    'se/common',
    'se/imageutils',
    'se/markup',
    'se/java',
], function (FaceUtils, common, imageutils, markup, Java) {
    const BasicStroke = Java.type('java.awt.BasicStroke');
    const Color = Java.type('java.awt.Color');
    const Tokens = ['Skull', 'Cultist', 'Tablet', 'ElderThing'];
    // by icons in the group
    const MinHeights = [48, 100, 152, 204];
    // by groups in the run; spaces them out when there are few
    const MinCenterSpacing = [115, 102, 85, 65];

    function groupMinHeight(block) {
        return MinHeights[
            Math.min(Math.max(block.tokens.length, 1), MinHeights.length) - 1
        ];
    }

    // the least height of the token blocks among blocks
    function minHeight(blocks) {
        return blocks.reduce(function (total, block) {
            return block.style === 'token' && block.text.length > 0
                ? total + groupMinHeight(block)
                : total;
        }, 0);
    }

    function scaled(text, scale) {
        return (
            '<size ' +
            scale * 100 +
            '%>' +
            text +
            '<size ' +
            (1 / scale) * 100 +
            '%>'
        );
    }

    // Paints blocks, with text, in region. trackerHeight: percent, 0 without a
    // tracking box. afterIntro: an intro block is directly above.
    function paint(
        g,
        diy,
        sheet,
        face,
        boxes,
        blocks,
        region,
        trackerHeight,
        afterIntro
    ) {
        var settings = diy.settings;
        var o = FaceUtils.plugin();
        var Region = common.Region;
        var iconRegion = settings.getRegion(
            face.key(settings, 'TokenIcon-region')
        );
        var iconInset = Number(
            settings.get(face.key(settings, 'TokenIcon-inset'), '0')
        );
        var tracker = trackerHeight > 0;
        var groupCount = blocks.length;

        var minSpacing = 15;
        var firstBlockOffset = 0;

        if (tracker) region.height -= (90 * trackerHeight) / 100.0;

        // help everything fit
        var iconCount = blocks.reduce(function (total, block) {
            return total + block.tokens.length;
        }, 0);
        if (tracker && iconCount > 3) region.y -= 5;

        // drawing a box after measuring it draws twice, so measure with another
        function measure(text, r) {
            var box = face.createBox(diy, sheet, 'Token');
            box.setLineTightness(
                Number(settings.get(face.key(settings, 'Token-tightness'))) *
                    o.bodyFontTightness
            );
            box.setTextFitting(markup.FIT_SCALE_TEXT);
            box.markupText = text;
            return box.measure(g, r);
        }

        var regions = blocks.map(function () {
            return new Region(region);
        });
        var heights = [];
        blocks.forEach(function (block, i) {
            let height = measure(block.text, regions[i]);
            // tall icons may rise above the region, to keep the text at its top
            if (!afterIntro && i === 0 && height < iconRegion.height) {
                firstBlockOffset = Math.min(
                    (iconRegion.height - height) / 2,
                    10
                );
            }
            heights[i] = Math.max(height, groupMinHeight(block));
        });
        if (tracker || afterIntro) firstBlockOffset = 0;

        var ends = (heights[0] + heights[groupCount - 1]) / 2;
        var centerSpacing = heights[0];
        var totalHeight = heights[0];

        if (groupCount > 1) {
            let fitted = Math.max(
                (region.height - ends) / (groupCount - 1),
                52
            );

            centerSpacing = 0;
            for (let i = 0; i < groupCount - 1; i++) {
                centerSpacing = Math.max(
                    centerSpacing,
                    (heights[i] + heights[i + 1]) / 2
                );
            }
            centerSpacing = Math.max(
                centerSpacing,
                MinCenterSpacing[
                    Math.min(groupCount, MinCenterSpacing.length) - 1
                ]
            );
            totalHeight =
                (centerSpacing + minSpacing) * (groupCount - 1) + ends;

            if (totalHeight > region.height) {
                minSpacing = Math.floor(fitted / 10);
                fitted -= minSpacing - 1;
                centerSpacing = fitted;
                totalHeight =
                    (centerSpacing + minSpacing) * (groupCount - 1) + ends;
            }
        }

        var even = totalHeight <= region.height;
        if (even) {
            if (totalHeight <= region.height * 0.6)
                region.y += (region.height - totalHeight) * 0.35;
        } else minSpacing = 1;

        var scale = 1.0;
        var scaledSpacing = minSpacing;

        if (region.height < totalHeight) {
            if (!afterIntro) {
                region.y -= 5 + firstBlockOffset;
                region.height += 5 + firstBlockOffset;
            }

            region.height = Math.max(
                region.height,
                minHeight(blocks) + minSpacing * (groupCount - 1)
            );

            do {
                scale -= 0.05;

                totalHeight = 0;
                blocks.forEach(function (block, i) {
                    heights[i] = Math.max(
                        measure(scaled(block.text, scale), regions[i]),
                        groupMinHeight(block)
                    );
                    totalHeight += heights[i];
                });

                minSpacing = (region.height - totalHeight) / (groupCount - 1);
                if (scaledSpacing < minSpacing) scaledSpacing = minSpacing;
                totalHeight += scaledSpacing * (groupCount - 1);
            } while (region.height < totalHeight && scale > 0.1);
        }

        scale = Math.max(scale, 0.5);

        var yOffset = even ? region.y + (heights[0] * scale) / 2 : region.y;

        blocks.forEach(function (block, i) {
            var r = regions[i];
            r.y = even ? yOffset - heights[i] / 2 : yOffset;
            r.height = heights[i];

            if (block.tokens.length > 1) {
                r.x += 8;
                r.width -= 8;
            } else {
                r.x = region.x;
                r.width = region.width;
            }

            var box = boxes.tokens[i];
            if (box == null)
                box = boxes.tokens[i] = face.createTokenBox(diy, sheet);
            box.markupText = scale < 1 ? scaled(block.text, scale) : block.text;

            if (even) {
                let textRegion = new Region(r.x, r.y, r.width, r.height);
                textRegion.y += parseInt(o.bodyFontOffset);
                box.draw(g, textRegion);
            } else box.draw(g, r);

            paintIcons(g, sheet, block, r, iconRegion, iconInset, even);

            yOffset += even
                ? scaledSpacing + centerSpacing * scale
                : minSpacing + heights[i];
        });
    }

    // Icons stack at the icon region's height, each drawn inset within it.
    function paintIcons(g, sheet, block, r, iconRegion, inset, even) {
        var Region = common.Region;
        var count = block.tokens.length;
        var iconMin = 1000;
        var iconMax = 0;

        block.tokens.forEach(function (token, n) {
            let iconY =
                r.y +
                r.height / 2 -
                (iconRegion.height * count) / 2 +
                n * iconRegion.height +
                (even ? -1 : 1);

            iconMin = Math.min(iconMin, iconY + 1, r.y);
            iconMax = Math.max(
                iconMax,
                iconY + iconRegion.height - 3,
                r.y + r.height
            );
            sheet.paintImage(
                g,
                imageutils.ImageUtils.get(
                    'ArkhamHorrorLCG/overlays/AHLCG-Chaos' + token + '.png'
                ),
                new Region(
                    iconRegion.x + inset,
                    iconY + inset,
                    iconRegion.width - 2 * inset,
                    iconRegion.height - 2 * inset
                )
            );
        });

        if (count > 1) {
            let end = even ? iconMax - 6 : iconMax - 1;
            let right = iconRegion.x + iconRegion.width;
            g.setPaint(Color.BLACK);
            g.setStroke(new BasicStroke(0.5));
            g.drawLine(right + 2, iconMin + 1, right + 2, end);
            g.drawLine(right + 4, iconMin + 1, right + 4, end);
        }
    }

    return {
        Tokens: Tokens,
        minHeight: minHeight,
        groupMinHeight: groupMinHeight,
        paint: paint,
    };
});
