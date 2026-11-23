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

function store(values) {
    return {
        get: (key, fallback) => (key in values ? values[key] : fallback === undefined ? null : fallback),
        getInt: (key, fallback) => (key in values ? Number(values[key]) : fallback),
        getBoolean: (key, fallback) => (key in values ? values[key] === 'yes' : fallback),
        getRegion2D(key) {
            const [x, y, width, height] = values[key].split(',').map(Number);
            return { x, y, width, height };
        },
        getTextStyle: () => null,
    };
}

const plugin = {
    TagList: [],
    StyleList: [],
    standardEncounterList: [
        ['Ghouls', 0, 'ghouls', 0],
        ['ReturnToTheGathering', 7, 'rgather', 1],
    ],
    standardCollectionList: [['NightOfTheZealot', 'notz', 0]],
    locationIcons: [],
};
let user = store({});

const Java = { type: () => function JavaClass() {} };
const FaceUtils = load('faces/FaceUtils.js', {
    'se/common': {
        Eons: { namedObjects: { AHLCGObject: plugin } },
        Settings: { getUser: () => user },
    },
    'se/java': Java,
    'se/strings': {},
    'se/ui': {},
}, { Java });

function face(template, dpi) {
    return {
        template,
        dpi,
        key(settings, name) {
            const key = this.template + '-' + name;
            return settings.get(key) != null ? key : 'AHLCG-Face-' + name;
        },
    };
}

function tags(settings, f) {
    const replacements = {};
    const box = {
        setReplacementForTag(tag, value) { replacements[tag] = value; },
        setStyleForTag() {},
    };
    FaceUtils.initBodyTags({ settings: store({ 'Arrow-tag': 'arrow', ...settings }) }, box, f);
    return replacements;
}

const ICON = 'res://ArkhamHorrorLCG/icons/AHLCG-';
const REGIONS = {
    'T-EncounterIcon-region': '171,58,30,30',
    'T-ReturnEncounterIcon-region': '171.25,58,45,34',
};

test('a bare encounter tag takes the width of the encounter icon region', () => {
    assert.equal(tags(REGIONS, face('T')).ghouls, '<image ' + ICON + 'Ghouls.png 0.2in baseline>');
});

test('a bare return set tag takes the width of the return icon region', () => {
    assert.equal(tags(REGIONS, face('T')).rgather, '<image ' + ICON + 'ReturnToTheGathering.png 0.3in baseline>');
});

test('a bare collection tag takes the width of the encounter icon region', () => {
    assert.equal(tags(REGIONS, face('T')).notz, '<image ' + ICON + 'NightOfTheZealot.png 0.2in baseline>');
});

test('region widths are in the face resolution', () => {
    assert.match(tags(REGIONS, face('T', 300)).ghouls, / 0\.1in /);
});

test('sizes are rounded to four places', () => {
    assert.match(tags({ 'T-EncounterIcon-region': '0,0,34,34' }, face('T')).ghouls, / 0\.2267in /);
});

test('suffixed tags keep their fixed sizes', () => {
    const replacements = tags(REGIONS, face('T'));
    assert.match(replacements.ghoulss, / 0\.14in /);
    assert.match(replacements.ghoulsm, / 0\.35in /);
    assert.match(replacements.ghoulsl, / 0\.60in /);
});

test('a bare tag is medium sized without a face', () => {
    assert.match(tags(REGIONS).ghouls, / 0\.35in /);
});

test('a bare tag is medium sized when the face has no icon region', () => {
    const replacements = tags({}, face('T'));
    assert.match(replacements.ghouls, / 0\.35in /);
    assert.match(replacements.rgather, / 0\.35in /);
});

test('a user icon tag is sized as its type', () => {
    user = store({
        'AHLCG-UserEncounterCount': '1',
        'AHLCG-UserEncounterTag1': 'MINE',
        'AHLCG-UserEncounterIcon1': '/icons/mine.png',
        'AHLCG-UserCollectionCount': '2',
        'AHLCG-UserCollectionTag1': 'coll',
        'AHLCG-UserCollectionIcon1': '/icons/coll.png',
        'AHLCG-UseUserCollection2': 'no',
    });
    try {
        const replacements = tags(REGIONS, face('T'));
        assert.equal(replacements.mine, '<image "/icons/mine.png" 0.2in baseline>');
        assert.equal(replacements.coll, '<image "/icons/coll.png" 0.2in baseline>');
        assert.match(replacements.mines, / 0\.14in /);
    } finally {
        user = store({});
    }
});

const ARROW_HEIGHT = (0.23 * 150) / 524;

function arrowTop(replacement) {
    const match = /^<image res:\/\/ArkhamHorrorLCG\/icons\/AHLCG-Arrow\.png 0\.23in baseline ([\d.]+)in>$/.exec(replacement);
    assert.ok(match, replacement);
    return Number(match[1]);
}

test('the arrow is centered on bare icons of the face', () => {
    const top = arrowTop(tags(REGIONS, face('T')).arrow);
    assert.ok(Math.abs(top - ARROW_HEIGHT / 2 - 0.2 / 2) < 1e-4);
});

test('the arrow is centered on medium icons without a face', () => {
    const top = arrowTop(tags(REGIONS).arrow);
    assert.ok(Math.abs(top - ARROW_HEIGHT / 2 - 0.35 / 2) < 1e-4);
});
