const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const diy = path.join(__dirname, '../ArkhamHorrorLCG/ArkhamHorrorLCG/resources/ArkhamHorrorLCG/diy');
function load(name, modules) {
    let result;
    vm.runInNewContext(fs.readFileSync(path.join(diy, name), 'utf8'), {
        define(deps, factory) { result = factory(...deps.map(name => modules[name])); },
    }, { filename: path.join(diy, name) });
    return result;
}

// Model the host binding's setting updates and sheet notifications.
function ComboBoxBinding(name, control, component, sheets) {
    Object.assign(this, { name, control, component, settings: component.settings, sheets });
    if (this.settings.get(name) != null) this.initComponent();
}
ComboBoxBinding.prototype.settingToControl = function (value, control) { control.value = value; };
ComboBoxBinding.prototype.controlToSetting = function (control) { return control.value; };
ComboBoxBinding.prototype.update = function () {
    if (this.control.value === this.settings.get(this.name)) return false;
    this.settings.set(this.name, this.control.value);
    this.sheets.forEach(i => this.component.markChanged(i));
    return true;
};
const ui = { ComboBoxBinding };
const SubtypeBinding = load('ui/SubtypeBinding.js', { 'se/ui': ui });

function component(values = {}) {
    return {
        changed: [],
        settings: {
            get: key => values[key] ?? null,
            set: (key, value) => { values[key] = value; },
            reset: key => { delete values[key]; },
        },
        markChanged(i) { this.changed.push(i); },
        values,
    };
}

for (const [key, side] of [['Subtype', 0], ['SubtypeBack', 1]]) {
    test(`${key}: missing and saved None stay absent without marking changes`, () => {
        for (const values of [{}, { [key]: 'None' }]) {
            const card = component(values);
            const control = { value: 'None' };
            const binding = new SubtypeBinding(key, control, card, [side]);
            binding.initComponent();
            assert.equal(control.value, 'None');
            assert.equal(binding.update(), false);
            assert.equal(Object.hasOwn(card.values, key), false);
            assert.deepEqual(card.changed, []);
        }
    });

    test(`${key}: weakness choices persist and selecting None deletes them`, () => {
        for (const subtype of ['BasicWeakness', 'Weakness', 'InvestigatorWeakness', 'StoryWeakness']) {
            const card = component({ [key]: subtype });
            const control = {};
            const binding = new SubtypeBinding(key, control, card, [side]);
            assert.equal(control.value, subtype);
            assert.equal(binding.update(), false);
            control.value = 'None';
            assert.equal(binding.update(), true);
            assert.equal(Object.hasOwn(card.values, key), false);
            assert.equal(binding.update(), false);
            control.value = subtype;
            assert.equal(binding.update(), true);
            assert.equal(card.values[key], subtype);
            assert.deepEqual(card.changed, [side, side]);
            control.value = null;
            assert.equal(binding.update(), false);
            assert.equal(card.values[key], subtype);
        }
    });
}

function Face() {}
Face.prototype.suffix = i => i === 0 ? '' : 'Back';
Face.prototype.setValues = function (card, side, keep, values) {
    for (const [key, value] of Object.entries(values)) {
        const name = key + this.suffix(side);
        if (!keep || card.settings.get(name) == null) card.settings.set(name, value);
    }
};
Face.prototype.setSettings = function () {};
const CardFace = load('faces/CardFace.js', {
    'faces/Face': Face,
    'ui/SubtypeBinding': SubtypeBinding,
    'se/ui': { ...ui, comboBox: function () { this.value = 'None'; } },
    'se/java': { type: () => ({ WHITE: {}, BLACK: {} }) },
});

test('defaults omit None, preserve weaknesses when upgrading, and clear them for a new face', () => {
    const face = new CardFace();
    face.subtypes = ['None', 'Weakness'];
    for (const side of [0, 1]) {
        const key = 'Subtype' + face.suffix(side);
        for (const value of [undefined, 'None', 'Weakness']) {
            const card = component(value === undefined ? {} : { [key]: value });
            face.setDefaults(card, side, true);
            assert.equal(card.settings.get(key), value === 'Weakness' ? value : null);
            face.setDefaults(card, side, false);
            assert.equal(Object.hasOwn(card.values, key), false);
        }
    }
});

test('subtype lists use the optional binding on both sides', () => {
    const face = new CardFace();
    face.subtypes = [];
    face.boundControls = [];
    for (const side of [0, 1]) {
        const bindings = { add(key, control, sheets, type) {
            assert.equal(key, 'Subtype' + face.suffix(side));
            assert.equal(sheets[0], side);
            assert.equal(type, SubtypeBinding);
        } };
        const list = face.createSubtypeList(bindings, side);
        assert.ok(face.boundControls.includes(list));
    }
});
