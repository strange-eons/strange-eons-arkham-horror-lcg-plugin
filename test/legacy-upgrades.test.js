const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.join(
    __dirname,
    '../ArkhamHorrorLCG/ArkhamHorrorLCG/resources/ArkhamHorrorLCG/diy'
);
function load(name, modules) {
    let result;
    vm.runInNewContext(fs.readFileSync(path.join(root, name), 'utf8'), {
        useLibrary() {},
        sourcefile: '',
        define(deps, factory) {
            result = typeof deps === 'function'
                ? deps()
                : factory(...deps.map(name => modules[name]));
        },
    }, { filename: path.join(root, name) });
    return result;
}

const FaceHandler = load('handlers/FaceHandler.js', {
    'handlers/CardVersion': 31,
    'faces/FaceUtils': { clearBleedMargin() {} },
    'se/diy': { FaceStyle: { TWO_FACES: 'TWO_FACES' } },
    'se/java': { type: () => function () {} },
});

function component(version, values = {}) {
    return {
        version,
        faceStyle: 'PLAIN_BACK',
        settings: {
            get: key => values[key] ?? null,
            set: (key, value) => { values[key] = value; },
            reset: key => { delete values[key]; },
        },
        setCornerRadius() {},
        values,
    };
}

function reader(config = {}) {
    const handler = Object.create(FaceHandler.prototype);
    const calls = [];
    Object.assign(handler, {
        version: 31,
        config,
        faces: [0, 1].map(side => ({
            setDefaults(card, index, keep) {
                assert.equal(index, side);
                assert.equal(keep, true);
                calls.push('defaults' + side);
            },
        })),
        setFaceTemplates() { calls.push('templates'); },
        updateCollector() {},
        legacyPortraits() { return []; },
        readLegacyPortraits() { calls.push('legacy'); },
        readPortraits() { calls.push('current'); },
        calls,
    });
    return handler;
}

test('reading old and already migrated cards restores two painted faces', () => {
    for (const version of [1, 14, 15, 16, 30, 31]) {
        for (const style of ['PLAIN_BACK', 'TWO_FACES']) {
            const card = component(version);
            card.faceStyle = style;
            const handler = reader();
            handler.onRead(card, {});
            assert.equal(card.faceStyle, 'TWO_FACES');
            assert.equal(card.version, 31);
            assert.deepEqual(handler.calls, version < 31
                ? ['defaults0', 'defaults1', 'templates', 'legacy']
                : ['current']);
        }
    }
});

function configuration(name) {
    let config;
    function ConfiguredHandler(value) { config = value; }
    load(name, {
        'handlers/exportHandler': () => {},
        'handlers/ShimHandler': ConfiguredHandler,
        'handlers/FaceChoiceHandler': ConfiguredHandler,
        'handlers/PlayerBacks': load('handlers/PlayerBacks.js', {}),
        'handlers/LegacyStoryAsset': load('handlers/LegacyStoryAsset.js', {}),
    });
    return config;
}

test('story art backs clear obsolete back metadata only before version 16', () => {
    const config = configuration('AssetStoryPortrait.js');
    for (const version of [1, 15, 16, 30]) {
        const card = component(version, {
            BackTypeundefined: 'Player',
            BackTypeBack: 'Player',
            ArtistBack: 'Artist',
        });
        reader(config).onRead(card, {});
        assert.equal(card.settings.get('CardClass'), 'Story');
        assert.equal(card.settings.get('ArtistBack'), 'Artist');
        for (const key of ['BackTypeundefined', 'BackTypeBack']) {
            assert.equal(card.settings.get(key), version < 16 ? null : 'Player');
        }
    }
});

test('skill upgrades clear the misspelled back setting and preserve back selection', () => {
    const config = configuration('Skill.js');
    for (const version of [1, 15, 16, 30]) {
        const card = component(version, {
            BackStatBack: 'Player',
            BackTypeundefined: 'Encounter',
        });
        config.upgradeChoices(card);
        assert.equal(card.settings.get('BackStatBack'), version < 16 ? null : 'Player');
        assert.equal(card.settings.get('BackTypeBack'), 'Encounter');
        assert.equal(card.settings.get('BackTypeundefined'), null);
    }
});
