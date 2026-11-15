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

const Java = { type: () => function JavaClass() {} };
const PlayerCard = load('faces/PlayerCard.js', { 'se/java': Java }, { Java });

const Asset = {
    Reward: 'Encounter-overlay',
    Story: 'Encounter-overlay',
    StoryWeakness: 'StoryWeakness-overlay',
    BasicWeakness: 'BasicWeaknessAsset',
};

function face(replaced = false) {
    const calls = [];
    return {
        calls,
        replaced,
        paintImage(g, diy, sheet, image, region) { calls.push([image, region]); },
        paintSubtype(g, diy, box, label) { calls.push([label]); },
    };
}

test('paintCircle paints each class circle once in its own region', () => {
    const cases = {
        Reward: [['overlays/AHLCG-Asset-EncounterSetOverlay.png', 'Encounter-overlay']],
        Story: [['overlays/AHLCG-Asset-EncounterSetOverlay.png', 'Encounter-overlay']],
        StoryWeakness: [['overlays/AHLCG-BasicWeaknessAsset.png', 'StoryWeakness-overlay']],
        BasicWeakness: [
            ['overlays/AHLCG-BasicWeaknessAsset.png', 'BasicWeaknessAsset'],
            ['icons/AHLCG-BasicWeakness.png', 'BasicWeaknessIcon'],
        ],
        Weakness: [],
        Guardian: [],
    };
    for (const [className, expected] of Object.entries(cases)) {
        const f = face();
        PlayerCard.paintCircle(f, null, null, null, className, Asset);
        assert.deepEqual(f.calls, expected, className);
    }
});

test('paintCircle leaves a replacement template alone', () => {
    for (const className of Object.keys(Asset)) {
        const f = face(true);
        PlayerCard.paintCircle(f, null, null, null, className, Asset);
        assert.deepEqual(f.calls, [], className);
    }
});

test('paintWeaknessSubtype labels only weaknesses', () => {
    const cases = {
        BasicWeakness: [['AHLCG-Label-BasicWeakness']],
        Weakness: [['AHLCG-Label-Weakness']],
        StoryWeakness: [['AHLCG-Label-Weakness']],
        Story: [],
        Reward: [],
        Guardian: [],
    };
    for (const [className, expected] of Object.entries(cases)) {
        const f = face();
        PlayerCard.paintWeaknessSubtype(f, null, null, null, className);
        assert.deepEqual(f.calls, expected, className);
    }
});

test('readKeyVariant names only a story weakness class', () => {
    const f = { suffix: i => (i ? '2' : ''), readKeyVariant: PlayerCard.readKeyVariant };
    for (const [className, expected] of [['StoryWeakness', 'StoryWeakness'], ['Story', null], ['BasicWeakness', null], ['Guardian', null]]) {
        const keys = [];
        const diy = { settings: { get(key, fallback) { keys.push(key); return key === 'CardClass2' ? className : fallback; } } };
        assert.equal(f.readKeyVariant(diy, 1), expected, className);
        assert.deepEqual(keys, ['CardClass2']);
    }
    assert.equal(f.readKeyVariant({ settings: { get: (k, d) => d } }, 0), null);
});
