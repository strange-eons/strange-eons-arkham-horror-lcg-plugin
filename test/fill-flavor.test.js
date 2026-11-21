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

const FillFlavor = load('faces/FillFlavor.js', {});

function settings(values) {
    return { get: (key, fallback) => (key in values ? values[key] : fallback) };
}

const PARTS = ['Traits', 'Keywords', 'Rules', 'Flavor', 'Victory'];
const TEXT = { Traits: 'Monster.', Rules: 'Hunter.', Flavor: 'It waits.', Victory: 'Victory 1.' };

function plain(list) {
    return JSON.parse(JSON.stringify(list));
}

test('fills is null unless the side fills and has flavor or victory', () => {
    assert.equal(FillFlavor.fills(settings(TEXT), PARTS, ''), null);
    assert.equal(FillFlavor.fills(settings({ ...TEXT, FillFlavor: '0' }), PARTS, ''), null);
    assert.equal(FillFlavor.fills(settings({ Rules: 'x', FillFlavor: '1' }), PARTS, ''), null);
    // a face without the parts
    assert.equal(FillFlavor.fills(settings({ ...TEXT, FillFlavor: '1' }), ['Rules'], ''), null);
});

test('fills centers flavor, else puts victory at the bottom, by side', () => {
    assert.deepEqual(plain(FillFlavor.fills(settings({ ...TEXT, FillFlavor: 'yes' }), PARTS, '')), [
        { part: 'Flavor', alignment: 'Middle' },
    ]);
    assert.deepEqual(plain(FillFlavor.fills(settings({ VictoryBack: 'V', FillFlavorBack: '1', FillFlavor: '0' }), PARTS, 'Back')), [
        { part: 'Victory', alignment: 'Bottom' },
    ]);
});

test('pads share the total equally, above and below by alignment', () => {
    const list = [
        { part: 'Flavor', alignment: 'Middle' },
        { part: 'Victory', alignment: 'Bottom' },
    ];
    assert.deepEqual(plain(FillFlavor.pads(list, 20)), {
        Flavor: { before: 5, after: 5 },
        Victory: { before: 10, after: 0 },
    });
});

test('solve finds the padding that fills the height', () => {
    // 2 pixels per point over 40
    const total = FillFlavor.solve(p => 40 + 2 * p, 100);
    assert.ok(total <= 30 && total > 29.5, String(total));
});

test('solve never overflows, keeping the largest total that fits', () => {
    // a line rewraps at 20 points, adding 15
    const measure = p => 40 + 2 * p + (p >= 20 ? 15 : 0);
    const total = FillFlavor.solve(measure, 100);
    assert.ok(measure(total) <= 100, String(total));
    assert.ok(total >= 19, String(total));
});

test('solve is null when the text overflows unpadded, and 0 when padding adds nothing', () => {
    assert.equal(FillFlavor.solve(() => 120, 100), null);
    assert.equal(FillFlavor.solve(() => 60, 100), 0);
});

test('isOn accepts check box and yes/no values', () => {
    for (const v of ['1', 'yes', 'true', 'Yes']) assert.equal(FillFlavor.isOn(v), true, v);
    for (const v of ['0', 'no', '', null]) assert.equal(FillFlavor.isOn(v), false, String(v));
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
    'faces/FillFlavor': FillFlavor,
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
    const s = settings({ ...TEXT, FillFlavor: '1' });
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
    assert.equal('Victory' in last, false);
    assert.equal(b.markupText, 'all');
    assert.equal(b.fitting, 'scale');
});

test('paintFilledBody draws nothing unfilled, or when text overflows', () => {
    const b = box();
    assert.equal(new CardFace().paintFilledBody(null, { settings: settings(TEXT) }, b, REGION, PARTS, '', null), false);
    const s = settings({ ...TEXT, Rules: 'a\nb\nc\nd\ne\nf\ng\nh\ni', FillFlavor: '1' });
    assert.equal(new CardFace().paintFilledBody(null, { settings: s }, b, REGION, PARTS, '', null), false);
    assert.deepEqual(b.draws, []);
    assert.equal(b.markupText, 'all');
    assert.equal(b.fitting, 'scale');
});

function recorder(values = {}) {
    const set = { ...values };
    return {
        set,
        settings: {
            getOverride: k => set[k] ?? null,
            set: (k, v) => { set[k] = String(v); },
            get: k => set[k] ?? null,
            reset() {},
        },
    };
}
function fillingFace() {
    const face = new CardFace();
    face.suffix = i => ['', 'Back'][i];
    face.setValues = () => {};
    face.setSettings = Face.prototype.setSettings = function (d, keep, values) {
        for (const k in values) {
            if (keep && d.settings.getOverride(k) != null) continue;
            d.settings.set(k, values[k]);
        }
    };
    return face;
}

test('a face fills flavor when its body draws Flavor', () => {
    const face = new CardFace();
    assert.equal(face.fillsFlavor(), true);
    face.parts = ['Rules', 'Victory'];
    assert.equal(face.fillsFlavor(), false);
    face.bodyParts = ['Rules', 'Flavor'];
    assert.equal(face.fillsFlavor(), true);
    face.parts = ['Rules', 'Flavor'];
    face.bodyParts = ['Rules'];
    assert.equal(face.fillsFlavor(), false);
});

test('setDefaults adds the fill key only for a face that fills flavor', () => {
    const face = fillingFace();
    face.parts = ['Rules', 'Victory'];
    let r = recorder();
    face.setDefaults(r, 1, false);
    assert.equal('FillFlavorBack' in r.set, false);
    delete face.parts;
    r = recorder();
    face.setDefaults(r, 1, false);
    assert.equal(r.set.FillFlavorBack, '0');
});

test('a new or newly chosen side takes the project choice; a set one keeps its own', () => {
    const face = fillingFace();
    let r = recorder();
    face.setDefaults(r, 0, false, { FillFlavor: '1' });
    assert.equal(r.set.FillFlavor, '1');
    r = recorder({ FillFlavorBack: '1' });
    face.setDefaults(r, 1, true, { FillFlavor: '0' });
    assert.equal(r.set.FillFlavorBack, '1');
    r = recorder({ FillFlavor: '0' });
    face.setDefaults(r, 0, true, { FillFlavor: '1' });
    assert.equal(r.set.FillFlavor, '1');
    r = recorder();
    face.setDefaults(r, 0, false, {});
    assert.equal(r.set.FillFlavor, '0');
});

// FaceUtils.partsMarkup with pads; spacers show as [points]
const RealFaceUtils = load('faces/FaceUtils.js', {
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
