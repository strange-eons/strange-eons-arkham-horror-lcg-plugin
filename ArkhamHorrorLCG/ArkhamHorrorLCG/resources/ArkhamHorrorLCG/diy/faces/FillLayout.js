// Game text parts that fill the body's leftover space. A part with text and
// <part><suffix>Fill set takes an equal share of the height the other parts
// leave, as space above and below it by <part><suffix>FillAlignment: below
// for Top, both for Middle, above for Bottom.
//
// Module: returns { ALIGNMENTS, isFill, fills, pads, solve }.
define(function () {
    const ALIGNMENTS = ['Top', 'Middle', 'Bottom'];
    const ABOVE = { Top: 0, Middle: 0.5, Bottom: 1 };

    function isFill(value) {
        return ['1', 'yes', 'true'].includes(String(value).toLowerCase());
    }

    // The parts with text that fill, as [ { part, alignment } ], or null.
    function fills(settings, parts, suffix) {
        var result = parts
            .filter(function (part) {
                return (
                    isFill(settings.get(part + suffix + 'Fill', '0')) &&
                    String(settings.get(part + suffix, '')) !== ''
                );
            })
            .map(function (part) {
                let alignment = String(
                    settings.get(part + suffix + 'FillAlignment', 'Top')
                );
                return {
                    part: part,
                    alignment: alignment in ABOVE ? alignment : 'Top',
                };
            });
        return result.length > 0 ? result : null;
    }

    // The space above and below each filling part, in points, sharing total:
    // { <part>: { before, after } }
    function pads(list, total) {
        var result = {};
        var share = total / list.length;
        list.forEach(function (fill) {
            let above = ABOVE[fill.alignment];
            result[fill.part] = {
                before: share * above,
                after: share * (1 - above),
            };
        });
        return result;
    }

    // The total padding, in points, at which measure( total ), the height of
    // the text, comes closest to height without passing it; null if the text
    // doesn't fit without padding. Text height grows in steps as lines
    // rewrap, so this keeps the largest total found to fit.
    function solve(measure, height) {
        var p0 = 0;
        var h0 = measure(p0);
        if (h0 > height) return null;
        var best = 0;
        var p1 = 10;
        for (let i = 0; i < 8; i++) {
            let h1 = measure(p1);
            // padding that shows nowhere, as below the last line
            if (h1 === h0) break;
            if (h1 <= height && p1 > best) best = p1;
            if (h1 <= height && height - h1 < 0.5) break;
            // aims a little short, as an overflowing box draws its outline
            let next = p1 + ((height - 0.25 - h1) * (p1 - p0)) / (h1 - h0);
            p0 = p1;
            h0 = h1;
            p1 = Math.max(0, next);
        }
        return best;
    }

    return {
        ALIGNMENTS: ALIGNMENTS,
        isFill: isFill,
        fills: fills,
        pads: pads,
        solve: solve,
    };
});
