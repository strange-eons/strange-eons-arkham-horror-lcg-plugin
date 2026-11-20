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
    setBackground(c) { this.background = c; }
    setForeground() {}
    setOpaque() {}
    setSelectionMode() {}
    setLayout(layout) { this.layout = layout; }
    setAlignmentX(x) { this.alignmentX = x; }
    setMaximumSize(size) { this.maximumSize = size; }
    getPreferredSize() { return { height: 16 }; }
    getBackground() { return 'white'; }
    clearSelection() { this.index = -1; this.cleared = (this.cleared ?? 0) + 1; }
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
// the user's part: user( pane ) clicks while the dialog shows and returns
// the option chosen
class JOptionPane {
    constructor(...args) { this.args = args; dialogs.push(this); }
    createDialog(parent, title) {
        this.title = title;
        const pane = this;
        return {
            setVisible() { pane.value = JOptionPane.user(pane); },
            dispose() { pane.disposed = true; },
        };
    }
    getValue() { return this.value; }
}
Object.assign(JOptionPane, { DEFAULT_OPTION: 'default', PLAIN_MESSAGE: 'plain', user: pane => pane.args[4][0] });
class JButton extends Fake {
    addActionListener(fn) { this.listeners.push(fn); }
    click() { this.listeners.forEach(fn => fn()); }
}
const choose = (index, before) => pane => {
    if (before) before(pane);
    return pane.args[4][index];
};
const registered = [];
const Actions = {
    PRIORITY_DEFAULT: 5,
    findActionByName: name => registered.find(a => a.getActionName() === name) ?? null,
    register: (a, priority) => registered.push(a),
};
let openProject = null;
// the editors open for each file
const appWindow = { open: {}, getEditorsShowingFile(file) { return this.open[file] ?? []; } };
// a card: an AHLCG handler whose sides use templates set by its handler
class DIY {
    constructor(values = {}, script = 'res://ArkhamHorrorLCG/diy/Enemy.js') {
        this.script = script;
        this.settings = settings({ 'AHLCG-EnemyFace-template': 'enemy.jp2', ...values });
    }
    getHandlerScript() { return this.script; }
    getFrontTemplateKey() { return 'Front'; }
    getBackTemplateKey() { return 'Back'; }
}
const caught = [];
class ListItem {
    constructor(id, label) { this.id = id; this.label = label; }
    toString() { return this.id; }
}
const types = {
    'ca.cgjennings.apps.arkham.diy.ListItem': ListItem,
    'ca.cgjennings.apps.arkham.StrangeEons': { getOpenProject: () => openProject, getWindow: () => appWindow },
    'ca.cgjennings.apps.arkham.diy.DIY': DIY,
    'ca.cgjennings.apps.arkham.project.Actions': Actions,
    'ca.cgjennings.ui.theme.Theme': {},
    'java.awt.BorderLayout': Object.assign(class extends Fake {}, { NORTH: 'north', CENTER: 'center', WEST: 'west' }),
    'java.awt.CardLayout': CardLayout,
    'java.awt.Font': { BOLD: 1 },
    'javax.swing.BorderFactory': { createEmptyBorder: () => 'empty' },
    'javax.swing.DefaultListModel': DefaultListModel,
    'javax.swing.JLabel': Fake,
    'javax.swing.JList': JList,
    'javax.swing.JOptionPane': JOptionPane,
    'javax.swing.BoxLayout': Object.assign(class extends Fake {}, { PAGE_AXIS: 'page' }),
    'java.awt.Component': { LEFT_ALIGNMENT: 0 },
    'java.awt.Dimension': class { constructor(w, h) { this.w = w; this.h = h; } },
    'java.lang.Integer': { valueOf: Number, MAX_VALUE: 2147483647 },
    'javax.swing.JButton': JButton,
    'javax.swing.JPanel': JPanel,
    'javax.swing.ListSelectionModel': {},
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
    checkBox: function (label, selected) { return {
        label,
        selected: selected === true,
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
const strings = { string: (key, ...args) => [key, ...args].join(' ') };

const AnchorLayout = load('faces/AnchorLayout.js', {});
const FaceUtils = load('faces/FaceUtils.js', {
    'se/common': {}, 'se/java': Java, 'se/strings': strings, 'se/ui': ui,
});
const Face = load('faces/Face.js', {
    'faces/FaceUtils': FaceUtils, 'se/common': {}, 'se/markup': {}, 'se/strings': strings, 'se/ui': ui, 'se/java': Java,
});
const CardFace = load('faces/CardFace.js', {
    'faces/CollectorInfo': {}, 'faces/Face': Face, 'faces/FaceUtils': FaceUtils, 'faces/AnchorLayout': AnchorLayout,
    'faces/PortraitArt': {}, 'ui/SubtypeBinding': {}, 'se/imageutils': {}, 'se/markup': {}, 'se/strings': strings,
    'se/ui': ui, 'se/java': Java,
});
const EnemyFace = load('faces/EnemyFace.js', {
    'faces/CardFace': CardFace, 'faces/Face': Face, 'faces/FaceUtils': FaceUtils, 'se/imageutils': {}, 'se/strings': strings,
    'se/ui': ui,
});
// ResourceKit reads and writes files by name: cards[name] is the card, or an
// Error to throw
const files = {};
const alerts = [];
const common = {
    ResourceKit: {
        written: [],
        getGameComponentFromFile(file) {
            if (files[file] instanceof Error) throw files[file];
            return files[file] ?? null;
        },
        writeGameComponentToFile(file, component) { this.written.push(file); },
    },
    alert: (message, isError) => alerts.push([message, isError]),
};
const ProjectDefaults = load('core/ProjectDefaults.js', { 'faces/AnchorLayout': AnchorLayout, 'se/java': Java });
const ProjectSettings = load('plugin/ProjectSettings.js', {
    'core/ProjectDefaults': ProjectDefaults, 'faces/EnemyFace': EnemyFace,
    'se/common': common, 'se/java': Java, 'se/strings': strings, 'se/ui': ui,
}, { Error: { handleUncaught(ex) { caught.push(ex); } } });

// ProjectDefaults

test('the project choice reads and writes AHLCG-AnchorVictory', () => {
    const s = settings();
    assert.equal(ProjectDefaults.enabled(s), false);
    ProjectDefaults.setEnabled(s, true);
    assert.deepEqual(s.values, { 'AHLCG-AnchorVictory': '1' });
    assert.equal(ProjectDefaults.enabled(s), true);
    ProjectDefaults.setEnabled(s, false);
    assert.equal(s.values['AHLCG-AnchorVictory'], '0');
});

test('a project opened without the choice: on without cards, off with them', () => {
    function project(values, kids) {
        const s = settings(values);
        return { ...member('project', kids), settings: s, writes: 0, getSettings: () => s, writeTaskSettings() { this.writes++; } };
    }
    let p = project({}, [member('notes.txt'), member('art', [member('a.png')])]);
    assert.equal(ProjectDefaults.initialize(p), true);
    assert.equal(p.settings.values['AHLCG-AnchorVictory'], '1');
    assert.equal(p.writes, 1);
    p = project({}, [member('art', [member('deep', [member('card.eon')])])]);
    assert.equal(ProjectDefaults.initialize(p), true);
    assert.equal(p.settings.values['AHLCG-AnchorVictory'], '0');
    p = project({ 'AHLCG-AnchorVictory': '1' }, [member('card.eon')]);
    assert.equal(ProjectDefaults.initialize(p), false);
    assert.equal(p.settings.values['AHLCG-AnchorVictory'], '1');
    assert.equal(p.writes, 0);
});

test('forNewCard gives an anchoring face the open project choice', () => {
    openProject = null;
    assert.equal(ProjectDefaults.forNewCard(new EnemyFace()), null);
    openProject = { getSettings: () => settings({ 'AHLCG-AnchorVictory': '1' }) };
    assert.deepEqual(plain(ProjectDefaults.forNewCard(new EnemyFace())), { AnchorVictory: '1' });
    assert.equal(ProjectDefaults.forNewCard(new CardFace()), null);
    openProject = { getSettings: () => settings() };
    assert.deepEqual(plain(ProjectDefaults.forNewCard(new EnemyFace())), { AnchorVictory: '0' });
    openProject = null;
});

test('an enemy new to a card takes the project choice on its side', () => {
    const c = { settings: settings() };
    new EnemyFace().setDefaults(c, 1, false, { AnchorVictory: '1' });
    assert.equal(c.settings.values.AnchorVictoryBack, '1');
    assert.equal('AnchorVictory' in c.settings.values, false);
});

// the dialog

test('the Game Text tab of an anchoring face ends with its check box', () => {
    const recorder = { entries: [], add(key, control) { this.entries.push([key, control]); } };
    const face = new EnemyFace();
    const panel = FaceUtils.createTextPanel(face, recorder, 1, face.parts, '', 6);
    const [key, check] = recorder.entries[recorder.entries.length - 1];
    assert.equal(key, 'AnchorVictoryBack');
    assert.equal(check.label, 'AHLCG-AnchorVictory');
    assert.equal(panel.placed[panel.placed.length - 2], check);
    const plainFace = new CardFace();
    plainFace.parts = ['Rules'];
    const r2 = { entries: [], add(key, control) { this.entries.push([key, control]); } };
    FaceUtils.createTextPanel(plainFace, r2, 0, plainFace.parts, '', 6);
    assert.deepEqual(r2.entries.map(([k]) => k), ['Rules']);
});

test('the Layout page shows, saves and applies the project choice', () => {
    const page = ProjectSettings.layoutPage(settings({ 'AHLCG-AnchorVictory': '1' }));
    assert.equal(page.label, 'AHLCG-ProjectSettings-Layout');
    assert.equal(page.panel.title, 'AHLCG-ProjectSettings-Layout');
    const check = page.panel.placed[0];
    assert.equal(check.label, 'AHLCG-AnchorVictory');
    assert.equal(check.selected, true);
    const target = settings();
    check.setSelected(false);
    page.save(target);
    assert.deepEqual(target.values, { 'AHLCG-AnchorVictory': '0' });
    const card = new DIY({ 'Front-template': 'enemy.jp2', 'Back-template': 'enemy.jp2' });
    assert.equal(page.applyToCard(card), true);
    assert.equal(card.settings.values.AnchorVictory, '0');
    assert.equal(card.settings.values.AnchorVictoryBack, '0');
    assert.equal(page.applyToCard(new DIY({})), false);
    assert.equal(ProjectSettings.layoutPage(settings()).panel.placed[0].selected, false);
});

test('the Settings action applies to a project and saves on OK', () => {
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

    const s = settings({ 'AHLCG-AnchorVictory': '1' });
    let writes = 0;
    const project = { getSettings: () => s, writeTaskSettings: () => { writes++; } };
    JOptionPane.user = choose(2);
    caught.length = 0;
    assert.equal(action.perform(project, null, null), false);
    assert.equal(writes, 0);
    // closed without a choice
    JOptionPane.user = () => null;
    assert.equal(action.perform(project, null, null), false);
    assert.equal(writes, 0);
    JOptionPane.user = choose(0);
    assert.equal(action.perform(project, null, null), true);
    assert.equal(writes, 1);
    assert.deepEqual(s.values, { 'AHLCG-AnchorVictory': '1' });
    assert.deepEqual(caught, []);

    // the face list beside the pages, the first shown
    const pane = dialogs[dialogs.length - 1];
    const [root, type, optionType, icon, options, initial] = pane.args;
    assert.equal(pane.title, 'AHLCG-ProjectSettings-Title');
    assert.equal(pane.disposed, true);
    assert.deepEqual([type, optionType, icon, initial], ['plain', 'default', null, 'ok']);
    assert.equal(options.length, 3);
    assert.deepEqual([options[0], options[1].args[0], options[2]], ['ok', 'AHLCG-ProjectSettings-Apply', 'cancel']);
    // the lists at the west, the pages in the center
    const [[side, west], [cards, center]] = root.children;
    assert.deepEqual([west, center], ['west', 'center']);
    assert.equal(side.layout.args[1], 'page');
    // header and list per section: Face Defaults
    const [facesHeader, facesList] = side.children.map(([c]) => c);
    assert.equal(side.children.length, 2);
    assert.equal(facesHeader.args[0], 'AHLCG-ProjectSettings-Face-Defaults');
    assert.deepEqual({ ...facesHeader.maximumSize }, { w: 2147483647, h: 16 });
    assert.deepEqual({ ...facesList.maximumSize }, { w: 2147483647, h: 16 });
    assert.equal(side.background, 'white');
    assert.deepEqual(plain(facesList.args[0].children), ['AHLCG-ProjectSettings-Layout']);
    assert.deepEqual(plain(cards.children.map(([c, name]) => name)), ['0-0']);
    assert.equal(cards.shown, '0-0');
    assert.deepEqual(plain(facesList.font), ['float', 11]);
    assert.deepEqual(plain(facesHeader.font), ['int,float', 1, 10]);
    facesList.index = -1;
    facesList.listeners.forEach(fn => fn());
    assert.equal(cards.shown, '0-0');
});

test('the Settings action reports a failure and does not save', () => {
    const action = registered[0];
    const project = { getSettings() { throw new Error('closed'); } };
    caught.length = 0;
    assert.equal(action.perform(project, null, null), false);
    assert.equal(caught.length, 1);
});

// the handlers pass project values to new faces only

function card(values = {}) {
    return { settings: settings(values) };
}

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

// Apply to all cards

const enemySides = { 'Front-template': 'enemy.jp2', 'Back-template': 'other.jp2' };

test('sidesOf finds the sides whose template is the face template', () => {
    const face = new EnemyFace();
    assert.deepEqual(plain(ProjectDefaults.sidesOf({ settings: settings() }, face)), []);
    assert.deepEqual(plain(ProjectDefaults.sidesOf(new DIY(enemySides, 'res://Other/x.js'), face)), []);
    assert.deepEqual(plain(ProjectDefaults.sidesOf(new DIY(enemySides), face)), [0]);
    assert.deepEqual(plain(ProjectDefaults.sidesOf(new DIY({ 'Front-template': 'x', 'Back-template': 'enemy.jp2' }), face)), [1]);
    assert.deepEqual(plain(ProjectDefaults.sidesOf(new DIY({ 'Front-template': 'enemy.jp2', 'Back-template': 'enemy.jp2' }), face)), [0, 1]);
    assert.deepEqual(plain(ProjectDefaults.sidesOf(new DIY({}), face)), []);
});

test('applyToCard sets the choice on the face sides', () => {
    const face = new EnemyFace();
    const c = new DIY({ 'Front-template': 'x', 'Back-template': 'enemy.jp2' });
    assert.equal(ProjectDefaults.applyToCard(c, face, true), true);
    assert.equal(c.settings.values.AnchorVictoryBack, '1');
    assert.equal('AnchorVictory' in c.settings.values, false);
    assert.equal(ProjectDefaults.applyToCard(new DIY({}), face, true), false);
});

function member(name, kids) {
    return {
        getChildren: () => kids ?? [],
        isFolder: () => kids != null,
        getExtension: () => name.split('.').pop(),
        getFile: () => name,
    };
}

test('applyToProject changes enemy cards, open ones in their editors', () => {
    const editor = (component) => ({
        component,
        calls: [],
        getGameComponent() { return this.component; },
        populateFieldsFromComponent() { this.calls.push('populate'); },
        forceRerender() { this.calls.push('rerender'); },
        setUnsavedChanges(v) { this.calls.push('unsaved ' + v); },
    });
    const openEnemy = editor(new DIY(enemySides));
    const openOther = editor(new DIY({}));
    appWindow.open = { 'open.eon': [openEnemy], 'openOther.eon': [openOther] };
    files['enemy.eon'] = new DIY(enemySides);
    files['other.eon'] = new DIY({});
    files['bad.eon'] = new Error('bad');
    common.ResourceKit.written = [];
    const project = member('project', [
        member('open.eon'), member('openOther.eon'), member('notes.txt'),
        member('folder', [member('enemy.eon'), member('other.eon'), member('missing.eon'), member('bad.eon')]),
    ]);
    const pages = [{ applyToCard: c => ProjectDefaults.applyToCard(c, new EnemyFace(), true) }];
    assert.deepEqual(plain(ProjectSettings.applyToProject(project, pages)), { changed: 2, failed: 2 });
    assert.equal(openEnemy.component.settings.values.AnchorVictory, '1');
    assert.deepEqual(openEnemy.calls, ['populate', 'rerender', 'unsaved true']);
    assert.deepEqual(openOther.calls, []);
    assert.equal(files['enemy.eon'].settings.values.AnchorVictory, '1');
    assert.deepEqual(common.ResourceKit.written, ['enemy.eon']);
    appWindow.open = {};
});

test('Apply to all cards saves and applies, leaving the dialog open', () => {
    const s = settings({ 'AHLCG-AnchorVictory': '1' });
    let writes = 0;
    files['enemy.eon'] = new DIY(enemySides);
    files['bad.eon'] = new Error('bad');
    const project = { ...member('project', [member('enemy.eon'), member('bad.eon')]), getSettings: () => s, writeTaskSettings: () => { writes++; } };
    alerts.length = 0;
    const open = [];
    const clickApply = pane => { pane.args[4][1].click(); open.push(pane.disposed !== true && pane.value === undefined); };
    // apply, then cancel: saved by apply
    JOptionPane.user = choose(2, clickApply);
    assert.equal(registered[0].perform(project, null, null), true);
    assert.deepEqual(open, [true]);
    assert.equal(writes, 1);
    assert.equal(files['enemy.eon'].settings.values.AnchorVictory, '1');
    assert.deepEqual(alerts, [['AHLCG-ProjectSettings-Applied 1\nAHLCG-ProjectSettings-ApplyFailed 1', true]]);
    // apply twice, then OK: saved each time
    delete files['bad.eon'];
    project.getChildren = () => [member('enemy.eon')];
    JOptionPane.user = choose(0, pane => { clickApply(pane); clickApply(pane); });
    assert.equal(registered[0].perform(project, null, null), true);
    assert.equal(writes, 4);
    assert.deepEqual(alerts.slice(1), [['AHLCG-ProjectSettings-Applied 1', false], ['AHLCG-ProjectSettings-Applied 1', false]]);
    // a failed apply is reported and leaves the dialog open
    caught.length = 0;
    project.writeTaskSettings = () => { throw new Error('read only'); };
    JOptionPane.user = choose(2, clickApply);
    assert.equal(registered[0].perform(project, null, null), false);
    assert.equal(caught.length, 1);
    assert.equal(open[open.length - 1], true);
    JOptionPane.user = choose(0);
});

test('a present function stands in for showing the dialog', () => {
    const s = settings();
    const project = { getSettings: () => s, writeTaskSettings() {} };
    const presented = [];
    JOptionPane.user = () => { throw new Error('shown'); };
    assert.equal(ProjectSettings.edit(project, dialog => presented.push(dialog)), false);
    assert.equal(presented.length, 1);
    assert.equal(dialogs[dialogs.length - 1].disposed, true);
    JOptionPane.user = choose(0);
});
