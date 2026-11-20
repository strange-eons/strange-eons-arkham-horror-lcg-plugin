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

// objects made in a module's context, as plain values
const plain = value => JSON.parse(JSON.stringify(value));

function settings(values = {}) {
    return {
        values,
        get: (key, fallback) => values[key] ?? fallback ?? null,
        getOverride: key => values[key] ?? null,
        set: (key, value) => { values[key] = String(value); },
        reset: key => { delete values[key]; },
    };
}

// Swing stand-ins: each records what it is given
class Fake {
    constructor(...args) { this.args = args; this.children = []; this.listeners = []; }
    add(child, where) { this.children.push([child, where]); }
    setBorder() {}
    setFont(font) { this.font = font; }
    getFont() { return { getStyle: () => 0, getSize: () => 12, 'deriveFont(float)': size => ['float', size], 'deriveFont(int,float)': (style, size) => ['int,float', style, size] }; }
    setBackground() {}
    setForeground() {}
    setOpaque() {}
    setSelectionMode() {}
    setHorizontalScrollBarPolicy() {}
    ['setDividerLocation(int)'](pixels) { this.divider = pixels; }
}
class CardLayout extends Fake { show(panel, name) { panel.shown = name; } }
class JPanel extends Fake { getLayout() { return this.args[0]; } }
class DefaultListModel extends Fake { addElement(e) { this.children.push(e); } }
class JList extends Fake {
    constructor(model) { super(model); this.index = -1; }
    addListSelectionListener(fn) { this.listeners.push(fn); }
    getSelectedIndex() { return this.index; }
    setSelectedIndex(i) { this.index = i; this.listeners.forEach(fn => fn()); }
}
const dialogs = [];
const JOptionPane = {
    DEFAULT_OPTION: 'default',
    PLAIN_MESSAGE: 'plain',
    choice: 0,
    showOptionDialog(...args) { dialogs.push(args); return this.choice; },
};
const registered = [];
const Actions = {
    PRIORITY_DEFAULT: 5,
    findActionByName: name => registered.find(a => a.getActionName() === name) ?? null,
    register: (a, priority) => registered.push(a),
};
let openProject = null;
const caught = [];
class ListItem {
    constructor(id, label) { this.id = id; this.label = label; }
    toString() { return this.id; }
}
const types = {
    'ca.cgjennings.apps.arkham.diy.ListItem': ListItem,
    'ca.cgjennings.apps.arkham.StrangeEons': { getOpenProject: () => openProject, getWindow: () => 'window' },
    'ca.cgjennings.apps.arkham.project.Actions': Actions,
    'ca.cgjennings.ui.theme.Theme': {},
    'java.awt.BorderLayout': Object.assign(class extends Fake {}, { NORTH: 'north', CENTER: 'center' }),
    'java.awt.CardLayout': CardLayout,
    'java.awt.Font': { BOLD: 1 },
    'java.lang.Integer': { valueOf: Number },
    'javax.swing.BorderFactory': { createEmptyBorder: () => 'empty' },
    'javax.swing.DefaultListModel': DefaultListModel,
    'javax.swing.JLabel': Fake,
    'javax.swing.JList': JList,
    'javax.swing.JOptionPane': JOptionPane,
    'javax.swing.JPanel': JPanel,
    'javax.swing.JScrollPane': Fake,
    'javax.swing.JSplitPane': Object.assign(class extends Fake {}, { HORIZONTAL_SPLIT: 1 }),
    'javax.swing.ListSelectionModel': {},
    'javax.swing.ScrollPaneConstants': {},
    'javax.swing.UIManager': { getColor: () => null },
};
const Java = {
    type: name => types[name] ?? {},
    extend: (name, methods) => methods,
};

// ui controls with the methods of the Swing controls they stand for
function text() {
    return { text: '', getText() { return this.text; }, setText(v) { this.text = v; }, getPreferredSize: () => ({ width: 100 }) };
}
const ui = {
    Grid: class { constructor() { this.placed = []; } setTitle(t) { this.title = t; } place(...items) { this.placed.push(...items); } realize() { return this; } },
    textField: text,
    textArea: text,
    tipButton: function () { return {}; },
    spinner: function () { return { value: 0, getValue() { return this.value; }, setValue(v) { this.value = v; } }; },
    checkBox: function () { return {
        selected: false,
        listeners: [],
        isSelected() { return this.selected; },
        setSelected(v) { this.selected = v; this.listeners.forEach(fn => fn()); },
        addItemListener(fn) { this.listeners.push(fn); },
    }; },
    comboBox: function (items) { return {
        items,
        index: 0,
        enabled: true,
        getSelectedItem() { return this.items[this.index] ?? null; },
        setSelectedIndex(i) { this.index = i; },
        getModel() { return { getSize: () => items.length, getElementAt: i => items[i] }; },
        setEnabled(v) { this.enabled = v; },
    }; },
};
const strings = { string: key => key };

const FillLayout = load('faces/FillLayout.js', {});
const FaceUtils = load('faces/FaceUtils.js', {
    'faces/FillLayout': FillLayout, 'se/common': {}, 'se/java': Java, 'se/strings': strings, 'se/ui': ui,
});
const Face = load('faces/Face.js', {
    'faces/FaceUtils': FaceUtils, 'se/common': {}, 'se/markup': {}, 'se/strings': strings, 'se/ui': ui, 'se/java': Java,
});
const CardFace = load('faces/CardFace.js', {
    'faces/CollectorInfo': {}, 'faces/Face': Face, 'faces/FaceUtils': FaceUtils, 'faces/FillLayout': FillLayout,
    'faces/PortraitArt': {}, 'ui/SubtypeBinding': {}, 'se/imageutils': {}, 'se/markup': {}, 'se/strings': strings,
    'se/ui': ui, 'se/java': Java,
});
const EnemyFace = load('faces/EnemyFace.js', {
    'faces/CardFace': CardFace, 'faces/Face': Face, 'faces/FaceUtils': FaceUtils, 'se/imageutils': {}, 'se/strings': strings,
    'se/ui': ui,
});
const ProjectDefaults = load('core/ProjectDefaults.js', { 'se/java': Java });
const ProjectSettings = load('plugin/ProjectSettings.js', {
    'core/ProjectDefaults': ProjectDefaults, 'faces/EnemyFace': EnemyFace, 'faces/FaceUtils': FaceUtils,
    'se/java': Java, 'se/strings': strings,
}, { Error: { handleUncaught(ex) { caught.push(ex); } } });

// ProjectDefaults

test('textDefaults lists the Game Text keys of a new card', () => {
    assert.deepEqual(plain(new EnemyFace().textDefaults()), {
        Traits: '', Keywords: '', Rules: '', Flavor: '', Victory: '',
        TraitsSpacing: '0', KeywordsSpacing: '0', RulesSpacing: '0', FlavorSpacing: '0',
        TraitsFill: '0', TraitsFillAlignment: 'Top', KeywordsFill: '0', KeywordsFillAlignment: 'Top',
        RulesFill: '0', RulesFillAlignment: 'Top', FlavorFill: '0', FlavorFillAlignment: 'Top',
        VictoryFill: '0', VictoryFillAlignment: 'Top',
    });
    const face = new CardFace();
    face.parts = ['Rules'];
    assert.deepEqual(plain(face.textDefaults()), { Rules: '' });
});

test('textKey puts the side suffix after the longest matching part', () => {
    const face = new CardFace();
    face.parts = ['Text1', 'Text10'];
    assert.equal(face.textKey('Text10Spacing', 1), 'Text10BackSpacing');
    assert.equal(face.textKey('Text1', 0), 'Text1');
    assert.equal(new EnemyFace().textKey('VictoryFillAlignment', 1), 'VictoryBackFillAlignment');
});

test('read and write keep values other than the defaults under the face template', () => {
    const face = new EnemyFace();
    const s = settings({ 'AHLCG-EnemyFace-RulesSpacing': '4', Other: 'x' });
    ProjectDefaults.write(s, face, { VictoryFill: '1', VictoryFillAlignment: 'Bottom', RulesSpacing: '0', Traits: 'Monster.', Unknown: '1' });
    assert.deepEqual(s.values, {
        Other: 'x',
        'AHLCG-EnemyFace-VictoryFill': '1',
        'AHLCG-EnemyFace-VictoryFillAlignment': 'Bottom',
        'AHLCG-EnemyFace-Traits': 'Monster.',
    });
    assert.deepEqual(plain(ProjectDefaults.read(s, face)), { Traits: 'Monster.', VictoryFill: '1', VictoryFillAlignment: 'Bottom' });
    assert.equal(ProjectDefaults.keyOf(face, 'Rules'), 'AHLCG-EnemyFace-Rules');
});

test('forNewCard reads the open project, for faces with project defaults only', () => {
    openProject = null;
    assert.equal(ProjectDefaults.forNewCard(new EnemyFace()), null);
    const s = settings({ 'AHLCG-EnemyFace-FlavorFill': '1' });
    openProject = { getSettings: () => s };
    assert.deepEqual(plain(ProjectDefaults.forNewCard(new EnemyFace())), { FlavorFill: '1' });
    assert.equal(ProjectDefaults.forNewCard(new CardFace()), null);
    openProject = null;
});

// CardFace.setDefaults with project values

function card(values = {}) {
    return { settings: settings(values) };
}

test('setDefaults without project values sets the face defaults', () => {
    const c = card();
    new EnemyFace().setDefaults(c, 1, false);
    assert.equal(c.settings.values.RulesBackSpacing, '0');
    assert.equal(c.settings.values.VictoryBackFillAlignment, 'Top');
    assert.equal(c.settings.values.VictoryBack, '');
    assert.equal(c.settings.values.HealthBack, '2');
});

test('a new card takes project values on either side', () => {
    const project = { Traits: 'Monster.', RulesSpacing: '3', VictoryFill: '1', VictoryFillAlignment: 'Bottom', Health: '9' };
    for (const [side, suffix] of [[0, ''], [1, 'Back']]) {
        const c = card({ ['Traits' + suffix]: 'old' });
        new EnemyFace().setDefaults(c, side, false, project);
        const v = c.settings.values;
        assert.equal(v['Traits' + suffix], 'Monster.');
        assert.equal(v['Rules' + suffix + 'Spacing'], '3');
        assert.equal(v['Victory' + suffix + 'Fill'], '1');
        assert.equal(v['Victory' + suffix + 'FillAlignment'], 'Bottom');
        // not a Game Text key
        assert.equal(v['Health' + suffix], '2');
    }
});

test('a face chosen for a card keeps values changed from the defaults', () => {
    const project = { Traits: 'Monster.', Rules: 'Hunter.', RulesSpacing: '3', FlavorFill: '1' };
    const c = card({ Traits: 'Humanoid.', Rules: '', RulesSpacing: '0' });
    new EnemyFace().setDefaults(c, 0, true, project);
    const v = c.settings.values;
    assert.equal(v.Traits, 'Humanoid.');
    assert.equal(v.Rules, 'Hunter.');
    assert.equal(v.RulesSpacing, '3');
    assert.equal(v.FlavorFill, '1');
    assert.equal(v.FlavorFillAlignment, 'Top');
});

test('a part the face sets compares against its own default', () => {
    function Face1() { CardFace.call(this); }
    Face1.prototype = Object.create(CardFace.prototype);
    Face1.prototype.parts = ['Rules'];
    Face1.prototype.defaultValues = () => ({ Rules: '30.' });
    const c = card({ Rules: '30.' });
    new Face1().setDefaults(c, 0, true, { Rules: '25.' });
    assert.equal(c.settings.values.Rules, '25.');
    const d = card({ Rules: '' });
    new Face1().setDefaults(d, 0, true, { Rules: '25.' });
    assert.equal(d.settings.values.Rules, '');
});

// the dialog

test('control values read and write as the card bindings store them', () => {
    const field = ui.textField();
    ProjectSettings.setValue(field, 'Monster.');
    assert.equal(ProjectSettings.getValue(field), 'Monster.');
    const spin = ui.spinner();
    ProjectSettings.setValue(spin, '4');
    assert.equal(ProjectSettings.getValue(spin), '4');
    spin.value = 2.6;
    assert.equal(ProjectSettings.getValue(spin), '3');
    const check = ui.checkBox();
    ProjectSettings.setValue(check, 'yes');
    assert.equal(ProjectSettings.getValue(check), '1');
    ProjectSettings.setValue(check, '0');
    assert.equal(ProjectSettings.getValue(check), '0');
    const combo = ui.comboBox(['Top', 'Middle', 'Bottom'].map(id => new ListItem(id)));
    ProjectSettings.setValue(combo, 'Bottom');
    assert.equal(ProjectSettings.getValue(combo), 'Bottom');
    ProjectSettings.setValue(combo, 'Sideways');
    assert.equal(ProjectSettings.getValue(combo), 'Bottom');
    assert.equal(ProjectSettings.getValue(ui.comboBox([])), '');
});

test('the enemy page binds every Game Text key, and only those', () => {
    const recorder = new ProjectSettings.Recorder();
    const face = new EnemyFace();
    FaceUtils.createTextPanel(face, recorder, 0, face.parts, '', 6);
    assert.deepEqual(plain(recorder.entries.map(e => e.key).sort()), Object.keys(face.textDefaults()).sort());
});

test('a page shows the project values and saves what changed', () => {
    const s = settings({ 'AHLCG-EnemyFace-Victory': 'Victory 1.', 'AHLCG-EnemyFace-VictoryFill': '1' });
    const page = ProjectSettings.page(EnemyFace, s);
    const victory = page.panel.placed.find(c => c && c.text === 'Victory 1.');
    assert.ok(victory);
    assert.equal(page.panel.placed.filter(c => c && c.selected === true).length, 1);
    victory.setText('Victory 2.');
    const saved = settings();
    page.save(saved);
    assert.deepEqual(saved.values, { 'AHLCG-EnemyFace-Victory': 'Victory 2.', 'AHLCG-EnemyFace-VictoryFill': '1' });
});

test('a saved page removes values set back to the defaults', () => {
    const s = settings({ 'AHLCG-EnemyFace-VictoryFill': '1', 'AHLCG-EnemyFace-VictoryFillAlignment': 'Bottom' });
    const page = ProjectSettings.page(EnemyFace, s);
    const check = page.panel.placed.find(c => c && typeof c.isSelected === 'function' && c.selected);
    const alignment = page.panel.placed.find(c => c && typeof c.getSelectedItem === 'function' && String(c.getSelectedItem()) === 'Bottom');
    assert.equal(alignment.enabled, true);
    check.setSelected(false);
    assert.equal(alignment.enabled, false);
    alignment.setSelectedIndex(0);
    page.save(s);
    assert.deepEqual(s.values, {});
});

test('the Settings action applies to a project and saves on OK only', () => {
    ProjectSettings.register();
    ProjectSettings.register();
    assert.equal(registered.length, 1);
    const action = registered[0];
    assert.equal(action.getActionName(), 'ahlcg-project-settings');
    assert.equal(action.getLabel(), 'AHLCG-ProjectSettings');
    assert.equal(action.appliesTo('p', null, null), true);
    assert.equal(action.appliesTo('p', 't', null), false);
    assert.equal(action.appliesTo('p', null, 'm'), false);
    assert.equal(action.appliesTo(null, null, null), false);

    const s = settings({ 'AHLCG-EnemyFace-RulesSpacing': '2' });
    let writes = 0;
    const project = { getSettings: () => s, writeTaskSettings: () => { writes++; } };
    JOptionPane.choice = 1;
    caught.length = 0;
    assert.equal(action.perform(project, null, null), false);
    assert.equal(writes, 0);
    JOptionPane.choice = 0;
    assert.equal(action.perform(project, null, null), true);
    assert.equal(writes, 1);
    assert.deepEqual(s.values, { 'AHLCG-EnemyFace-RulesSpacing': '2' });
    assert.deepEqual(caught, []);

    // the face list beside the pages, the first shown
    const [, split, title, , , , options] = dialogs[dialogs.length - 1];
    assert.equal(title, 'AHLCG-ProjectSettings-Title');
    assert.deepEqual(plain(options), ['ok', 'cancel']);
    const [side, cards] = split.args.slice(1);
    const list = side.children.find(([, where]) => where === 'center')[0].args[0];
    assert.deepEqual(plain(list.args[0].children), ['AHLCG-Face-enemy']);
    assert.equal(cards.shown, '0');
    assert.equal(split.divider, 150);
    assert.deepEqual(plain(list.font), ['float', 11]);
    assert.deepEqual(plain(side.children[0][0].font), ['int,float', 1, 10]);
    assert.equal(side.children[0][0].args[0], 'AHLCG-ProjectSettings-Face-Defaults');
    list.index = -1;
    list.listeners.forEach(fn => fn());
    assert.equal(cards.shown, '0');
});

test('the Settings action reports a failure and does not save', () => {
    const action = registered[0];
    const project = { getSettings() { throw new Error('closed'); } };
    caught.length = 0;
    assert.equal(action.perform(project, null, null), false);
    assert.equal(caught.length, 1);
});

// the handlers pass project values to new faces only

function recordingFace(name) {
    return {
        name,
        calls: [],
        projectDefaults: true,
        setDefaults(d, i, keep, project) { this.calls.push([i, keep, project]); },
        clearType() {},
    };
}
const forNewCard = face => (face.projectDefaults ? { from: face.name } : null);

test('a new or cleared card gives each face the project values', () => {
    const FaceHandler = load('handlers/FaceHandler.js', {
        'core/ProjectDefaults': { forNewCard },
        'faces/FaceUtils': {},
        'se/diy': {},
        'se/java': { type: () => function () {} },
    });
    const handler = {
        faces: [recordingFace('front'), recordingFace('back')],
        setCardDefaults() {},
        copyrightFaces: () => [],
        templateReplacementFaces: () => [],
        updateCollector() {},
    };
    FaceHandler.prototype.setDefaults.call(handler, {});
    assert.deepEqual(plain(handler.faces.map(f => f.calls)), [
        [[0, false, { from: 'front' }]],
        [[1, false, { from: 'back' }]],
    ]);
});

test('only a face the user chooses takes the project values', () => {
    function FaceHandler(config, front, back) { this.config = config; this.faces = [front, back]; }
    FaceHandler.prototype.setFace = function (i, face) { this.faces[i] = face; };
    FaceHandler.prototype.setFaceTemplates = function () {};
    FaceHandler.prototype.updateCollector = function () {};
    const FaceChoiceHandler = load('handlers/FaceChoiceHandler.js', {
        'core/ProjectDefaults': { forNewCard },
        'handlers/FaceHandler': FaceHandler,
        'se/strings': strings,
        'se/ui': ui,
        'se/java': Java,
        require: () => {},
    });
    const made = [];
    const face = name => function () { const f = recordingFace(name); made.push(f); return f; };
    const handler = new FaceChoiceHandler({
        settings: ['FrontFace', null],
        choices: [
            [{ id: 'a', label: 'A', face: face('a') }, { id: 'b', label: 'B', face: face('b') }],
            [{ id: 'back', label: 'Back', face: face('back') }],
        ],
    });
    const c = card({ FrontFace: 'b' });
    // read: the saved face is applied without project values
    handler.applyFaceSettings(c);
    assert.equal(handler.faces[0].name, 'b');
    assert.deepEqual(plain(handler.faces[0].calls), [[0, true, null]]);
    // chosen in the editor: only the changed side
    c.settings.values.FrontFace = 'a';
    handler.applyFaceSettings(c, true);
    assert.deepEqual(plain(handler.faces[0].calls), [[0, true, { from: 'a' }]]);
    assert.deepEqual(plain(handler.faces[1].calls), [[1, true, null], [1, true, null]]);
    // unchanged
    handler.applyFaceSettings(c, true);
    assert.deepEqual(plain(handler.faces[0].calls), [[0, true, { from: 'a' }], [0, true, null]]);
});
