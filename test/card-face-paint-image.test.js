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
        define(deps, factory) { result = factory(...deps.map(name => modules[name])); },
    }, { filename: path.join(diy, name) });
    return result;
}

function Face() {}
Face.prototype.key = function (settings, name) {
    const key = this.template + '-' + name;
    return settings.get(key) != null ? key : 'AHLCG-Face-' + name;
};
const Java = { type: () => ({ WHITE: 'white', BLACK: 'black' }) };
const imageutils = { ImageUtils: { get: key => ({ image: key }) } };
const CardFace = load('faces/CardFace.js', {
    'faces/Face': Face,
    'se/imageutils': imageutils,
    'se/java': Java,
}, { Java });

function face() {
    const f = new CardFace();
    f.template = 'AHLCG-TestFace';
    return f;
}

function settings(values) {
    const region = key => (values[key] == null ? null : { key, value: values[key] });
    return {
        get: key => values[key] ?? null,
        getRegion: region,
        getRegion2D: region,
    };
}

function graphics(clip = 'card') {
    const calls = [];
    return {
        calls,
        getClip: () => clip,
        clip(shape) { calls.push(['clip', shape.key]); },
        setClip(shape) { calls.push(['setClip', shape]); },
    };
}

function sheet(g) {
    return { paintImage(_, image, region) { g.calls.push(['paint', image.image, region.key ?? region]); } };
}

test('paintImage clips to <region>-clip-region and restores the clip', () => {
    const g = graphics();
    const card = { settings: settings({
        'AHLCG-TestFace-Overlay-region': '14,5,50,50',
        'AHLCG-TestFace-Overlay-clip-region': '14,5,50,49.25',
    }) };
    face().paintImage(g, card, sheet(g), 'overlays/x.png', 'Overlay');
    assert.deepEqual(g.calls, [
        ['clip', 'AHLCG-TestFace-Overlay-clip-region'],
        ['paint', 'ArkhamHorrorLCG/overlays/x.png', 'AHLCG-TestFace-Overlay-region'],
        ['setClip', 'card'],
    ]);
});

test('paintImage leaves the clip alone without a clip region', () => {
    const g = graphics();
    const card = { settings: settings({ 'AHLCG-TestFace-Overlay-region': '14,5,50,50' }) };
    face().paintImage(g, card, sheet(g), 'overlays/x.png', 'Overlay');
    assert.deepEqual(g.calls, [
        ['paint', 'ArkhamHorrorLCG/overlays/x.png', 'AHLCG-TestFace-Overlay-region'],
    ]);
});

test('paintImage with an area and no region skips the clip lookup', () => {
    const g = graphics();
    const card = { settings: settings({}) };
    face().paintImage(g, card, sheet(g), 'overlays/x.png', null, 'area');
    assert.deepEqual(g.calls, [['paint', 'ArkhamHorrorLCG/overlays/x.png', 'area']]);
});

test('key prefers the variant setting, then the weakness, then the face', () => {
    const f = face();
    const values = {
        'AHLCG-TestFace-StoryWeakness-EncounterIcon-region': '1,1,1,1',
        'AHLCG-TestFace-EncounterIcon-region': '2,2,2,2',
        'AHLCG-TestFace-Label-region': '3,3,3,3',
    };
    const s = settings(values);
    assert.equal(f.key(s, 'EncounterIcon-region'), 'AHLCG-TestFace-EncounterIcon-region');
    f.keyVariant = 'StoryWeakness';
    assert.equal(f.key(s, 'EncounterIcon-region'), 'AHLCG-TestFace-StoryWeakness-EncounterIcon-region');
    assert.equal(f.key(s, 'Label-region'), 'AHLCG-TestFace-Label-region');
    assert.equal(f.key(s, 'Missing-region'), 'AHLCG-Face-Missing-region');
});

test('readSubtype sets the story weakness key variant', () => {
    const f = face();
    f.subtypes = ['None', 'Weakness', 'StoryWeakness'];
    f.suffix = () => '';
    for (const [subtype, expected] of [['StoryWeakness', 'StoryWeakness'], ['Weakness', null], ['None', null], ['Bogus', null]]) {
        f.readSubtype({ settings: { get: () => subtype } }, 0);
        assert.equal(f.keyVariant, expected, subtype);
    }
});
