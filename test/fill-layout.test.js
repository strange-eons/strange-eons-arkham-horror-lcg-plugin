const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const diy = path.join(__dirname, '../ArkhamHorrorLCG/ArkhamHorrorLCG/resources/ArkhamHorrorLCG/diy');
function load(name, modules, globals = {}) {
    let result;
    vm.runInNewContext(fs.readFileSync(path.join(diy, name), 'utf8'), {
        ...globals,
        define(deps, factory) {
            if (typeof deps === 'function') result = deps();
            else result = factory(...deps.map(name => modules[name]));
        },
    }, { filename: path.join(diy, name) });
    return result;
}

const FillLayout = load('faces/FillLayout.js', {});

function settings(values) {
    return { get: (key, fallback) => (key in values ? values[key] : fallback) };
}

const PARTS = ['Traits', 'Keywords', 'Rules', 'Flavor', 'Victory'];
const TEXT = { Traits: 'Monster.', Rules: 'Hunter.', Flavor: 'It waits.', Victory: 'Victory 1.' };

function plain(list) {
    return JSON.parse(JSON.stringify(list));
}

test('fills is null when no part with text fills', () => {
    assert.equal(FillLayout.fills(settings(TEXT), PARTS, ''), null);
    // Keywords has no text
    assert.equal(FillLayout.fills(settings({ ...TEXT, KeywordsFill: '1' }), PARTS, ''), null);
});

test('fills lists the filling parts in order with their alignments', () => {
    const s = settings({ ...TEXT, VictoryFill: 'yes', VictoryFillAlignment: 'Bottom', FlavorFill: '1', FlavorFillAlignment: 'Middle' });
    assert.deepEqual(plain(FillLayout.fills(s, PARTS, '')), [
        { part: 'Flavor', alignment: 'Middle' },
        { part: 'Victory', alignment: 'Bottom' },
    ]);
});

test('fills reads the face suffix and takes Top for unset or bad alignments', () => {
    const s = settings({ RulesBack: 'x', VictoryBack: 'y', RulesBackFill: '1', RulesBackFillAlignment: 'Sideways', VictoryBackFill: '1' });
    assert.deepEqual(plain(FillLayout.fills(s, ['Rules', 'Victory'], 'Back')), [
        { part: 'Rules', alignment: 'Top' },
        { part: 'Victory', alignment: 'Top' },
    ]);
});

test('pads share the total equally, above and below by alignment', () => {
    const fills = [
        { part: 'Traits', alignment: 'Top' },
        { part: 'Flavor', alignment: 'Middle' },
        { part: 'Victory', alignment: 'Bottom' },
    ];
    assert.deepEqual(plain(FillLayout.pads(fills, 30)), {
        Traits: { before: 0, after: 10 },
        Flavor: { before: 5, after: 5 },
        Victory: { before: 10, after: 0 },
    });
});

test('solve finds the padding that fills the height', () => {
    // 2 pixels per point over 40
    const total = FillLayout.solve(p => 40 + 2 * p, 100);
    assert.ok(total <= 30 && total > 29.5, String(total));
});

test('solve never overflows, keeping the largest total that fits', () => {
    // a line rewraps at 20 points, adding 15
    const measure = p => 40 + 2 * p + (p >= 20 ? 15 : 0);
    const total = FillLayout.solve(measure, 100);
    assert.ok(measure(total) <= 100, String(total));
    assert.ok(total >= 19, String(total));
});

test('solve is null when the text overflows unpadded, and 0 when padding adds nothing', () => {
    assert.equal(FillLayout.solve(() => 120, 100), null);
    assert.equal(FillLayout.solve(() => 60, 100), 0);
});

test('isFill accepts check box and yes/no values', () => {
    for (const v of ['1', 'yes', 'true', 'Yes']) assert.equal(FillLayout.isFill(v), true, v);
    for (const v of ['0', 'no', '', null]) assert.equal(FillLayout.isFill(v), false, String(v));
});

// CardFace.paintFilledBody with a box 10 high per line, plus 1 per point of
// pads; partsMarkup records the pads it is given

function Face() {}
const Java = { type: () => ({}) };
const padsSeen = [];
const FaceUtils = {
    partsMarkup(s, parts, suffix, formats, pads) {
        padsSeen.push(pads);
        const text = parts.map(part => String(s.get(part + suffix, ''))).filter(t => t !== '').join('\n');
        if (!pads) return text;
        const points = Object.values(pads).reduce((sum, p) => sum + p.before + p.after, 0);
        return text + '|' + points;
    },
};
const markup = { FIT_NONE: 'none', FIT_SCALE_TEXT: 'scale' };
const CardFace = load('faces/CardFace.js', {
    'faces/Face': Face,
    'faces/FaceUtils': FaceUtils,
    'faces/FillLayout': FillLayout,
    'se/markup': markup,
    'se/java': Java,
}, { Java });

function box() {
    const draws = [];
    return {
        draws,
        markupText: 'all',
        fitting: 'scale',
        setTextFitting(f) { this.fitting = f; },
        measure() {
            const [text, points] = this.markupText.split('|');
            return text.split('\n').length * 10 + Number(points ?? 0);
        },
        draw(g, r) { draws.push([this.markupText, r, this.fitting]); },
    };
}
const REGION = { x: 0, y: 100, width: 50, height: 100 };

test('paintFilledBody draws one box with the pads that fill the region', () => {
    const b = box();
    padsSeen.length = 0;
    const s = settings({ ...TEXT, FlavorFill: '1', FlavorFillAlignment: 'Middle', VictoryFill: '1', VictoryFillAlignment: 'Bottom' });
    assert.equal(new CardFace().paintFilledBody(null, { settings: s }, b, REGION, PARTS, '', null), true);
    // 4 lines, 60 points of pads
    assert.equal(b.draws.length, 1);
    const [text, region, fitting] = b.draws[0];
    assert.equal(region, REGION);
    assert.equal(fitting, 'none');
    const points = Number(text.split('|')[1]);
    assert.ok(points > 59 && points <= 60, text);
    const last = padsSeen[padsSeen.length - 1];
    assert.equal(last.Flavor.before, last.Flavor.after);
    assert.equal(last.Victory.after, 0);
    assert.equal(b.markupText, 'all');
    assert.equal(b.fitting, 'scale');
});

test('paintFilledBody draws nothing without a filling part, or when text overflows', () => {
    const b = box();
    assert.equal(new CardFace().paintFilledBody(null, { settings: settings(TEXT) }, b, REGION, PARTS, '', null), false);
    const s = settings({ ...TEXT, Rules: 'a\nb\nc\nd\ne\nf\ng\nh\ni', VictoryFill: '1' });
    assert.equal(new CardFace().paintFilledBody(null, { settings: s }, b, REGION, PARTS, '', null), false);
    assert.deepEqual(b.draws, []);
    assert.equal(b.markupText, 'all');
    assert.equal(b.fitting, 'scale');
});

test('setDefaults adds fill keys only for a face that fills parts', () => {
    function recorder() {
        const set = {};
        return { set, settings: { getOverride: () => null, set: (k, v) => { set[k] = v; }, get: () => null, reset() {} } };
    }
    const face = new CardFace();
    face.suffix = () => 'Back';
    face.setValues = () => {};
    face.setSettings = Face.prototype.setSettings = function (d, keep, values) {
        for (const k in values) d.settings.set(k, values[k]);
    };
    let r = recorder();
    face.setDefaults(r, 1, false);
    assert.equal('VictoryBackFill' in r.set, false);
    face.fillsParts = true;
    r = recorder();
    face.setDefaults(r, 1, false);
    assert.equal(r.set.TraitsBackFill, '0');
    assert.equal(r.set.VictoryBackFillAlignment, 'Top');
});

// FaceUtils.partsMarkup with pads; spacers show as [points]
const RealFaceUtils = load('faces/FaceUtils.js', {
    'faces/FillLayout': FillLayout,
    'se/common': {},
    'se/java': Java,
    'se/strings': {},
    'se/ui': {},
}, { Java });
function marked(values, pads) {
    return RealFaceUtils.partsMarkup(settings(values), ['Rules', 'Flavor', 'Victory'], '', null, pads)
        .replace(/<image res:\/\/ArkhamHorrorLCG\/images\/empty1x1\.png 1pt ([\d.]+)pt>/g, '[$1]');
}
const SPACED = { Rules: 'R', RulesSpacing: '2', Flavor: 'F', FlavorSpacing: '0', Victory: 'V' };

test('partsMarkup without pads is unchanged by an empty pad map', () => {
    assert.equal(marked(SPACED), '<left>R\n[3.5]\n<center><fs>F</fs>\n[1.5]\n<center><vic>V</vic>');
    assert.equal(marked(SPACED, {}), marked(SPACED));
});

test('partsMarkup merges pads into the spacing around a part', () => {
    assert.equal(
        marked(SPACED, { Flavor: { before: 4, after: 6 } }),
        '<left>R\n[7.5]\n<center><fs>F</fs>\n[7.5]\n<center><vic>V</vic>'
    );
});

test('partsMarkup adds spacer lines for pads where there is no spacing', () => {
    // Rules first: space above it is a line of its own; Victory last: below
    assert.equal(
        marked(SPACED, { Rules: { before: 3, after: 0 }, Victory: { before: 0, after: 5 } }),
        '[3]\n<left>R\n[3.5]\n<center><fs>F</fs>\n[1.5]\n<center><vic>V</vic>\n[5]'
    );
    // Victory below a part without spacing
    assert.equal(
        marked({ Rules: 'R', Victory: 'V' }, { Victory: { before: 2, after: 0 } }),
        '<left>R\n[2]\n<center><vic>V</vic>'
    );
});

test('partsMarkup ignores pads of parts without text', () => {
    assert.equal(marked({ ...SPACED, Flavor: '' }, { Flavor: { before: 4, after: 6 } }), marked({ ...SPACED, Flavor: '' }));
});
