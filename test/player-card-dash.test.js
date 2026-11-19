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
const Java = { type: () => function JavaClass() {} };
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
const FaceUtils = { plugin: () => ({}) };
const PlayerCard = load('faces/PlayerCard.js', { 'faces/FaceUtils': FaceUtils, 'se/common': common, 'se/imageutils': imageutils, 'se/java': Java }, { Java });

const face = { key: (settings, name) => 'AHLCG-TestFace-' + name };
const sheet = { paintImage: (g, image, r) => calls.push(['image', image, { ...r }]) };
function card(values) {
    return {
        settings: {
            get: (key, fallback) => (key in values ? values[key] : fallback),
            getRegion: () => ({ x: 0, y: 0, width: 40, height: 30 }),
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

test('paintDash takes its width from <name>-width', () => {
    calls.length = 0;
    vectors.length = 0;
    const svg = 'ArkhamHorrorLCG/numbers/AHLCG-Cost--.svg';
    const values = { 'AHLCG-TestFace-Dash-image': svg, 'AHLCG-TestFace-Dash-width': '18' };
    PlayerCard.paintDash(face, 'g', card(values), sheet, { x: 0, y: 0, width: 40, height: 30 }, 0);
    const height = (18 * 4.63) / 11.43;
    assert.deepEqual(vectors, [svg]);
    assert.deepEqual(calls, [['vector', 11, (30 - height) / 2, 18, height, true]]);
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

test('paintStat fits a null stat dash to its own fractional region', () => {
    for (const name of ['Stamina', 'Sanity']) {
        calls.length = 0;
        vectors.length = 0;
        const svg = `ArkhamHorrorLCG/numbers/AHLCG-${name}--.svg`;
        const diy = card({ [name]: '-', [`AHLCG-TestFace-${name}Dash-image`]: svg });
        diy.settings.getRegion2D = key => {
            assert.equal(key, `AHLCG-TestFace-${name}Dash-region`);
            return { x: 1.5, y: 2.25, width: 15, height: 6.5 };
        };
        PlayerCard.paintStat(face, 'g', diy, sheet, '', name);
        assert.deepEqual(vectors, [svg], name);
        assert.equal(calls[0][1], `ArkhamHorrorLCG/overlays/AHLCG-${name}Base.png`, name);
        assert.deepEqual(calls[1], ['vector', 1.5, 2.25, 15, 6.5, true], name);
    }
});
