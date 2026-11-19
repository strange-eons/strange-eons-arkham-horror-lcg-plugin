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

const calls = [];
const vectors = [];
const Java = {
    type: () => function TintFilter(h, s, b) {
        this.filter = image => ({ image, tint: [h, s, b] });
    },
};
const common = {
    ResourceKit: {
        getVectorImage(name) {
            vectors.push(name);
            return {
                getWidth: () => 11.43,
                getHeight: () => 4.63,
                paint: (...args) => calls.push(['vector', ...args.slice(1)]),
            };
        },
    },
};
const imageutils = { ImageUtils: { get: name => name } };
const PlayerCard = load('faces/PlayerCard.js', { 'se/common': common, 'se/imageutils': imageutils, 'se/java': Java }, { Java });

const face = { key: (settings, name) => 'AHLCG-TestFace-' + name };
const sheet = { paintImage: (g, image, r) => calls.push(['image', image, { ...r }]) };
function card(values) {
    return {
        settings: {
            get: key => values[key],
            getTint: key => values[key],
        },
    };
}

test('paintDash paints a Dash-image vector 20 wide, centered with its offsets', () => {
    calls.length = 0;
    vectors.length = 0;
    const svg = 'ArkhamHorrorLCG/numbers/AHLCG-Cost-Clues-Location--.svg';
    PlayerCard.paintDash(face, 'g', card({ 'AHLCG-TestFace-Dash-image': svg }), sheet, { x: 10, y: 20, width: 40, height: 30 }, 2, 6);
    const height = (20 * 4.63) / 11.43;
    assert.deepEqual(vectors, [svg]);
    assert.deepEqual(calls, [['vector', 10 + 10 + 2, 20 + (30 - height) / 2 + 6, 20, height, true]]);
});

test('paintDash tints the dash image without a Dash-image', () => {
    const r = { x: 10, y: 20, width: 40, height: 30 };
    for (const [tint, image] of [
        [[38, 0.14, 1], 'ArkhamHorrorLCG/numbers/AHLCG-Cost--.png'],
        [[38, 0.14, -1], 'ArkhamHorrorLCG/numbers/AHLCG-Cost--Inverted.png'],
    ]) {
        calls.length = 0;
        PlayerCard.paintDash(face, 'g', card({ 'AHLCG-TestFace-Dash-tint': tint }), sheet, { ...r }, 0);
        assert.deepEqual(calls, [['image', { image, tint: [38, 0.14, 1] }, { x: 17, y: 30, width: 26, height: 10 }]]);
    }
});

test('paintDash reads a named dash image', () => {
    calls.length = 0;
    vectors.length = 0;
    const svg = 'ArkhamHorrorLCG/numbers/AHLCG-Cost-Clues-Act--.svg';
    const values = {
        'AHLCG-TestFace-Dash-image': 'ArkhamHorrorLCG/numbers/AHLCG-Cost-Clues-Location--.svg',
        'AHLCG-TestFace-ShroudDash-image': svg,
    };
    PlayerCard.paintDash(face, 'g', card(values), sheet, { x: 0, y: 0, width: 20, height: 10 }, 0, 0, 'ShroudDash');
    assert.deepEqual(vectors, [svg]);
    assert.equal(calls.length, 1);
});
