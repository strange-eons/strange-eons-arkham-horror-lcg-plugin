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
const imageutils = { ImageUtils: { get: path => ({ image: path }) } };
const PlayerCard = load('faces/PlayerCard.js', { 'se/java': Java, 'se/imageutils': imageutils }, { Java });

function card(values) {
    return {
        settings: {
            get: (key, fallback) => values[key] ?? fallback ?? null,
            getRegion: key => ({ region: key }),
        },
    };
}

const face = {
    key: (settings, name) => 'AHLCG-AssetFace-' + name,
};

test('a card dreams when checked, unless it is a weakness or reward', () => {
    const dreaming = card({ Dreaming: '1' });
    assert.equal(PlayerCard.isDreaming(dreaming, '', 'Guardian'), true);
    assert.equal(PlayerCard.isDreaming(dreaming, '', 'Story'), true);
    for (const never of ['Weakness', 'BasicWeakness', 'StoryWeakness', 'Reward'])
        assert.equal(PlayerCard.isDreaming(dreaming, '', never), false, never);
    assert.equal(PlayerCard.isDreaming(card({ Dreaming: '0' }), '', 'Guardian'), false);
    assert.equal(PlayerCard.isDreaming(card({}), '', 'Guardian'), false);
    assert.equal(PlayerCard.isDreaming(card({ DreamingBack: '1' }), 'Back', 'Rogue'), true);
});

test('the crystal ball shows the level; no level shows level 0', () => {
    const cases = { 0: '0', 3: '3', 5: '5', None: '0', '': '0' };
    for (const [level, shown] of Object.entries(cases)) {
        const calls = [];
        const sheet = { paintImage(g, image, region) { calls.push([image.image, region.region]); } };
        PlayerCard.paintDreaming(face, null, card({ Level: level }), sheet, '');
        assert.deepEqual(calls, [[
            'ArkhamHorrorLCG/overlays/AHLCG-Dreaming-' + shown + '.png',
            'AHLCG-AssetFace-Dreaming-region',
        ]], level);
    }
});

test('the dreaming box is off for weakness and reward; dreaming turns the cost field off', () => {
    let selected = false;
    let cardClass = 'Guardian';
    const listeners = {};
    const box = name => ({
        enabled: null,
        setEnabled(on) { this.enabled = on; },
        addActionListener(l) { listeners[name] = l; },
    });
    const classBox = { ...box('class'), getSelectedItem: () => ({ toString: () => cardClass }) };
    const dreaming = { ...box('dreaming'), isSelected: () => selected };
    const cost = box('cost');
    const populate = [];
    const f = { addPopulateListener(bindings, l) { populate.push([bindings, l]); } };

    PlayerCard.linkDreaming(f, 'bindings', classBox, dreaming, cost);
    assert.deepEqual([dreaming.enabled, cost.enabled], [true, true]);
    assert.equal(populate[0][0], 'bindings');

    selected = true;
    listeners.dreaming();
    assert.deepEqual([dreaming.enabled, cost.enabled], [true, false]);

    // a class that can't dream keeps its cost, though the box stays checked
    for (const never of ['Weakness', 'Reward']) {
        cardClass = never;
        listeners.class();
        assert.deepEqual([dreaming.enabled, cost.enabled], [false, true], never);
    }

    cardClass = 'Seeker';
    selected = false;
    populate[0][1]();
    assert.deepEqual([dreaming.enabled, cost.enabled], [true, true]);
});
