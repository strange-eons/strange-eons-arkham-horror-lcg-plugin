// Victory text at the bottom of the body and flavor text centered in the
// space the other parts leave, as space in the body's markup, when
// AnchorVictory<suffix> is set: Flavor takes the leftover space evenly above
// and below; without Flavor, Victory takes it above.
//
// Module: returns { KEY, isOn, anchors, pads, solve }.
define(function () {
    const KEY = 'AnchorVictory';
    const ABOVE = { Middle: 0.5, Bottom: 1 };

    function isOn(value) {
        return ['1', 'yes', 'true'].includes(String(value).toLowerCase());
    }

    function hasText(settings, parts, part, suffix) {
        return (
            parts.indexOf(part) >= 0 &&
            String(settings.get(part + suffix, '')) !== ''
        );
    }

    // the part that takes the leftover space, as [ { part, alignment } ], or
    // null when the side doesn't anchor or has neither part
    function anchors(settings, parts, suffix) {
        if (!isOn(settings.get(KEY + suffix, '0'))) return null;
        if (hasText(settings, parts, 'Flavor', suffix))
            return [{ part: 'Flavor', alignment: 'Middle' }];
        if (hasText(settings, parts, 'Victory', suffix))
            return [{ part: 'Victory', alignment: 'Bottom' }];
        return null;
    }

    // the space above and below each part, in points, sharing total:
    // { <part>: { before, after } }
    function pads(list, total) {
        var result = {};
        var share = total / list.length;
        list.forEach(function (entry) {
            let above = ABOVE[entry.alignment];
            result[entry.part] = {
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
        KEY: KEY,
        isOn: isOn,
        anchors: anchors,
        pads: pads,
        solve: solve,
    };
});
