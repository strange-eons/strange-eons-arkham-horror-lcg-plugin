const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

class Grid {
    constructor() { this.children = []; }
    setTitle(title) { this.title = title; }
    place(...items) { this.children.push(...items.filter(item => typeof item === 'object')); }
    realize() { return this; }
    getComponentCount() { return this.children.length; }
    remove(child) { this.children.splice(this.children.indexOf(child), 1); }
    revalidate() {}
    repaint() {}
    addToEditor(editor, title, icon, tip, index) {
        const tabs = editor.getTabbedPane();
        tabs.insertTab(title, icon, this, tip, index ?? tabs.getTabCount() - 1);
        return this;
    }
}
Grid.prototype['add(java.awt.Component,java.lang.Object,int)'] = function (child, hint, index) {
    this.children.splice(index, 0, child);
};
class Tabs {
    constructor() { this.tabs = [{ title: 'Comments', component: {} }]; }
    getTabCount() { return this.tabs.length; }
    getComponentAt(index) { return this.tabs[index].component; }
    indexOfComponent(component) { return this.tabs.findIndex(tab => tab.component === component); }
    insertTab(title, icon, component, tip, index) { this.tabs.splice(index, 0, { title, component }); }
    remove(component) { this.tabs.splice(this.indexOfComponent(component), 1); }
}
class Bindings {
    constructor() { this.controls = new Map(); }
    add(key, control, faces) { this.controls.set(control, { key, faces: Array.from(faces) }); }
    remove(control) { assert.ok(this.controls.delete(control), 'control was bound'); }
    bind() {}
    flush() {}
}
class PortraitPanel {
    constructor(card, index, title) { Object.assign(this, { index, title }); }
    updatePanel() { this.updated = true; }
}
const ui = {
    Grid,
    portraitPanel: PortraitPanel,
    checkBox: function (title) { this.title = title; },
    textField: function () {},
    button: function (title, icon, action) { Object.assign(this, { title, action }); },
};
const filename = path.join(__dirname,
    '../ArkhamHorrorLCG/ArkhamHorrorLCG/resources/ArkhamHorrorLCG/diy/handlers/FaceHandler.js');
let FaceHandler;
vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    define(deps, factory) {
        const modules = {
            'se/ui': ui,
            'handlers/Collector': {
                createTab: () => ({ panel: new Grid(), title: 'Collection', controls: [] }),
            },
            'se/strings': { string: key => key.replace('AHLCG-', '') },
            'se/java': { type: () => function (value) { return value; } },
            'se/imageutils': { ImageUtils: { mirror: image => 'mirrored ' + image } },
            'ui/Bindings': Bindings,
        };
        FaceHandler = factory(...deps.map(name => modules[name]));
    },
}, { filename });

function face(names) {
    return {
        portraits: names,
        suffix: side => side === 0 ? '' : 'Back',
        createInterface() {
            return { general: [{ panel: new Grid(), title: 'Stats' }],
                tabs: [{ panel: new Grid(), title: 'Rules' }] };
        },
        removeInterface() {},
    };
}
function setup(front, back) {
    const tabs = new Tabs();
    const editor = { getTabbedPane: () => tabs, setGameComponent() {} };
    const card = { settings: { addPropertyChangeListener() {} }, markChanged() {} };
    const handler = new FaceHandler({}, face(front), face(back));
    handler.art = [front.map(() => ({})), back.map(() => ({}))];
    handler.portraitKinds = ['Collection'];
    handler.portraits = [{}];
    handler.usesKind = () => true;
    handler.copyrightFaces = () => [];
    handler.templateReplacementFaces = () => [];
    handler.createInterface(card, editor);
    return { handler, tabs, card };
}
function descend(panel, type) {
    return (panel.children || []).flatMap(child =>
        [...(child instanceof type ? [child] : []), ...descend(child, type)]);
}
function keys(handler) {
    return [...handler.bindings.controls.values()].map(binding => binding.key).sort();
}

test('portraits share a scrolling tab after both sides of rules', () => {
    for (const [front, back] of [[[], []], [['Portrait'], []], [[], ['Portrait']],
        [['Portrait'], ['Portrait']], [['Portrait', 'Detail'], ['Portrait']]]) {
        const { handler, tabs } = setup(front, back);
        const titles = tabs.tabs.map(tab => tab.title);
        assert.deepEqual(titles, ['General', 'Rules: Front', 'Rules: Back',
            ...(front.length + back.length ? ['Portraits'] : []), 'Collection', 'Comments']);
        assert.equal(handler.collectorTabIndex(), titles.indexOf('Collection'));
        if (handler.artTab == null) {
            assert.deepEqual(keys(handler), []);
            continue;
        }
        const panel = handler.artTab.component;
        assert.equal(panel.editorTabScrolling, true);
        const portraits = descend(panel, PortraitPanel);
        assert.deepEqual(portraits.map(portrait => portrait.index),
            Array.from({ length: front.length + back.length }, (_, index) => index));
        const both = front.length && back.length;
        assert.deepEqual(portraits.map(portrait => portrait.title), [
            ...front.map(() => both ? 'Portrait: Front' : 'Portrait'),
            ...back.map(() => both ? 'Portrait: Back' : 'Portrait'),
        ]);
        assert.deepEqual(descend(panel, Grid).filter(grid => grid.title).map(grid => grid.title), [
            ...(front.length ? [both ? 'Options: Front' : 'Options'] : []),
            ...(back.length ? [both ? 'Options: Back' : 'Options'] : []),
        ]);
        assert.deepEqual(keys(handler), [
            ...(front.length ? ['Artist'] : []),
            ...(back.length ? ['ArtistBack'] : []),
            ...(both ? ['PortraitShare'] : []),
        ]);
    }
});

test('switching either face refreshes indexes and bindings without duplicate tabs', () => {
    const { handler, tabs, card } = setup(['Portrait'], ['Portrait']);
    const backRules = handler.sideInterfaces[1].tabs[0];
    const switchSide = (side, names) => handler.changeFace(card, side, () => {
        handler.faces[side] = face(names);
        handler.art[side] = names.map(() => ({}));
    });
    switchSide(0, []);
    assert.equal(handler.sideInterfaces[1].tabs[0], backRules);
    assert.deepEqual(keys(handler), ['ArtistBack']);
    assert.equal(descend(handler.artTab.component, PortraitPanel)[0].index, 0);
    switchSide(0, ['Portrait', 'Detail']);
    assert.deepEqual(descend(handler.artTab.component, PortraitPanel).map(p => p.index), [0, 1, 2]);
    assert.deepEqual(keys(handler), ['Artist', 'ArtistBack', 'PortraitShare']);
    switchSide(1, ['Other']);
    assert.deepEqual(keys(handler), ['Artist', 'ArtistBack']);
    switchSide(1, []);
    switchSide(0, []);
    assert.equal(handler.artTab, null);
    assert.deepEqual(keys(handler), []);
    switchSide(1, ['Portrait']);
    assert.deepEqual(keys(handler), ['ArtistBack']);
    assert.deepEqual(tabs.tabs.map(tab => tab.title),
        ['General', 'Rules: Front', 'Rules: Back', 'Portraits', 'Collection', 'Comments']);
});

test('front artist updates both sheets and mirroring keeps portrait placement', () => {
    const { handler, card } = setup(['Portrait'], ['Portrait']);
    const portrait = {
        getScale: () => 2, getRotation: () => 3, getPanX: () => 4, getPanY: () => 5,
        getSource: () => 'source', getImage: () => 'image',
        setImage(source, image) { Object.assign(this, { source, image }); },
        setScale(value) { this.scale = value; }, setRotation(value) { this.rotation = value; },
        setPanX(value) { this.panX = value; }, setPanY(value) { this.panY = value; },
    };
    handler.removeArtInterface();
    handler.art[0] = [portrait];
    handler.addArtInterface(card);
    const panel = handler.artTab.component;
    descend(panel, ui.button)[0].action();
    assert.deepEqual([portrait.source, portrait.image, portrait.scale, portrait.rotation,
        portrait.panX, portrait.panY], ['source', 'mirrored image', 2, 3, 4, 5]);
    assert.equal(descend(panel, PortraitPanel)[0].updated, true);
    const bindings = [...handler.bindings.controls.values()];
    assert.deepEqual(bindings.find(binding => binding.key === 'Artist').faces, [0, 1]);
    assert.deepEqual(bindings.find(binding => binding.key === 'ArtistBack').faces, [1]);
});
