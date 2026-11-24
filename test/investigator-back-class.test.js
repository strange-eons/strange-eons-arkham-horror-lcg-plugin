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

function CardFace() {}
CardFace.prototype.setDefaults = function () {};
CardFace.prototype.setSettings = function (diy, keep, values) {
    for (const key in values) {
        if (keep && diy.settings.getOverride(key) != null) continue;
        diy.settings.set(key, values[key]);
    }
};
CardFace.prototype.bindKey = function (bindings, faceIndex, key, control) {
    bindings.push([key, control]);
};
function ListItem(value, label) { this.value = value; this.label = label; }
const Java = { type: () => ListItem };
const FaceUtils = { plugin: () => ({ comboClassesI: [new ListItem('Seeker', 'Seeker')] }) };
const strings = { string: key => key };
const ui = {
    comboBox: function (items) { this.items = items; },
    Grid: function () { this.place = (...args) => { this.placed = args; }; },
};
const modules = {
    'faces/CardFace': CardFace,
    'faces/CollectorInfo': {},
    'faces/FaceUtils': FaceUtils,
    'faces/PlayerCard': {},
    'faces/PortraitArt': {},
    'se/java': Java,
    'se/strings': strings,
    'se/ui': ui,
};
modules['faces/InvestigatorFace'] = load('faces/InvestigatorFace.js', modules);
const InvestigatorBackFace = load('faces/InvestigatorBackFace.js', modules);

function card(values) {
    return {
        settings: {
            get: (key, value) => values[key] ?? value ?? null,
            getOverride: key => values[key] ?? null,
            set(key, value) { values[key] = value; },
        },
    };
}

test('the back shows the card class while its own says Copy front', () => {
    const face = new InvestigatorBackFace();
    assert.equal(face.cardClass(card({ CardClass: 'Seeker', CardClassBack: 'Copy front' }), 1), 'Seeker');
});

test('a back without its own class shows the card class', () => {
    const face = new InvestigatorBackFace();
    assert.equal(face.cardClass(card({ CardClass: 'Mystic' }), 1), 'Mystic');
});

test('the back class overrides the card class', () => {
    const face = new InvestigatorBackFace();
    assert.equal(face.cardClass(card({ CardClass: 'Seeker', CardClassBack: 'Rogue' }), 1), 'Rogue');
});

test('a back with neither class is a Guardian', () => {
    assert.equal(new InvestigatorBackFace().cardClass(card({}), 1), 'Guardian');
});

test('defaults copy the front, and keep keeps a chosen back class', () => {
    const face = new InvestigatorBackFace();
    const fresh = {};
    face.setDefaults(card(fresh), 1, false);
    assert.equal(fresh.CardClassBack, 'Copy front');
    const kept = { CardClassBack: 'Survivor' };
    face.setDefaults(card(kept), 1, true);
    assert.equal(kept.CardClassBack, 'Survivor');
});

test('the class list binds CardClassBack, Copy front first and Story last', () => {
    const bindings = [];
    new InvestigatorBackFace().createClassPanel(bindings, 1);
    assert.equal(bindings.length, 1);
    const [key, list] = bindings[0];
    assert.equal(key, 'CardClassBack');
    assert.deepEqual(Array.from(list.items, item => item.value), ['Copy front', 'Seeker', 'Story']);
});
