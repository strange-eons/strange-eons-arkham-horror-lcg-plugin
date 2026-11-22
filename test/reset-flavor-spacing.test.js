const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const script = path.join(__dirname, '../scripts/reset-flavor-spacing.js');
// compiled once, so coverage counts every run; the flags come from options
const compiled = new vm.Script(
    fs.readFileSync(script, 'utf8')
        .replace('var APPLY = false;', 'var APPLY = options.apply;')
        .replace('var AFTER_FLAVOR = false;', 'var AFTER_FLAVOR = options.after;'),
    { filename: script }
);

class DIY {
    constructor(values, script = 'res://ArkhamHorrorLCG/diy/Enemy.js') {
        this.values = { ...values };
        this.script = script;
    }
    getHandlerScript() { return this.script; }
    getSettings() {
        const values = this.values;
        return {
            get: (key, fallback) => values[key] ?? fallback ?? null,
            getOverride: key => values[key] ?? null,
            set: (key, value) => { values[key] = String(value); },
        };
    }
}

// a path under the project folder
const filePath = name => ({
    name,
    toString: () => name,
    getParent: () => filePath(name.split('/').slice(0, -1).join('/')),
    resolve: other => filePath(name + '/' + other),
    toFile: () => ({ name, getParentFile: () => ({ mkdirs() {} }) }),
    relativize: other => filePath(other.name.replace(/^project\//, '')),
});
const file = name => ({ name, toPath: () => filePath(name) });
function member(name, kids) {
    return {
        getChildren: () => kids ?? [],
        isFolder: () => kids != null,
        getExtension: () => name.split('.').pop(),
        getFile: () => file(name),
    };
}

// runs the script with APPLY and AFTER_FLAVOR as given; returns what it printed and did
function run({ apply, after = false, cards, open = {}, noProject = false, edt = true }) {
    const out = { lines: [], written: [], copied: [], synced: 0, waits: 0 };
    const kids = Object.keys(cards).map(name => member('project/' + name));
    const project = {
        ...member('project', kids),
        getFile: () => ({ toPath: () => filePath('project') }),
        synchronize: () => { out.synced++; },
    };
    let onEdt = edt;
    const context = {
        options: { apply, after },
        println: line => out.lines.push(String(line)),
        importClass() {},
        java: { io: {}, nio: { file: {} }, awt: {} },
        Packages: { ca: { cgjennings: { apps: { arkham: { diy: { DIY }, project: {} } } } } },
        File: Object.assign(function (parent, child) { return { toPath: () => filePath('project/' + child) }; }, { separator: '/' }),
        ProjectUtilities: { copyFile: (from, to) => out.copied.push(to.name) },
        EventQueue: {
            isDispatchThread: () => onEdt,
            invokeAndWait(fn) { out.waits++; onEdt = true; try { fn(); } finally { onEdt = edt; } },
        },
        Eons: {
            getOpenProject: () => (noProject ? null : project),
            getWindow: () => ({ getEditorsShowingFile: f => open[f.name.replace(/^project\//, '')] ?? [] }),
        },
        ResourceKit: {
            getGameComponentFromFile(f) {
                const card = cards[f.name.replace(/^project\//, '')];
                if (card instanceof Error) throw card;
                return card;
            },
            writeGameComponentToFile: f => out.written.push(f.name),
        },
    };
    compiled.runInNewContext(context);
    return out;
}

const centered = { FillFlavor: '1', Rules: 'R', RulesSpacing: '4', Flavor: 'F', FlavorSpacing: '3' };

test('a dry run lists centered flavor sides and changes nothing', () => {
    const card = new DIY(centered);
    const out = run({ apply: false, cards: { 'a.eon': card } });
    assert.deepEqual(out.lines, [
        'Would change (APPLY is false) spacing before centered flavor text:',
        '  a.eon: RulesSpacing 4 -> 0',
        '1 card(s) to change.',
    ]);
    assert.equal(card.values.RulesSpacing, '4');
    assert.deepEqual(out.written, []);
});

test('apply zeroes only the spacing after the nearest text above flavor, backed up', () => {
    const cards = {
        // empty Rules between Keywords and Flavor: Keywords' spacing only
        'a.eon': new DIY({ FillFlavor: '1', Traits: 'T', TraitsSpacing: '5', Keywords: 'K', KeywordsSpacing: '2', RulesSpacing: '1', Flavor: 'F', FlavorSpacing: '3' }),
        // back side only
        'b.eon': new DIY({ FillFlavorBack: '1', RulesBack: 'R', RulesBackSpacing: '6', FlavorBack: 'F', RulesSpacing: '6', Flavor: 'F' }),
    };
    const out = run({ apply: true, cards });
    assert.deepEqual(cards['a.eon'].values.KeywordsSpacing, '0');
    assert.deepEqual(cards['a.eon'].values.RulesSpacing, '1');
    assert.deepEqual(cards['a.eon'].values.TraitsSpacing, '5');
    assert.deepEqual(cards['a.eon'].values.FlavorSpacing, '3');
    assert.deepEqual(cards['b.eon'].values.RulesBackSpacing, '0');
    assert.deepEqual(cards['b.eon'].values.RulesSpacing, '6');
    assert.deepEqual(out.written, ['project/a.eon', 'project/b.eon']);
    assert.deepEqual(out.copied, ['project/flavor-spacing-backup/a.eon', 'project/flavor-spacing-backup/b.eon']);
    assert.equal(out.synced, 1);
    assert.equal(out.lines.at(-1), 'Backups of changed files are in flavor-spacing-backup.');
});

test('AFTER_FLAVOR also zeroes the spacing after flavor', () => {
    const cards = {
        'a.eon': new DIY(centered),
        // nothing above flavor: only after
        'b.eon': new DIY({ FillFlavorBack: '1', FlavorBack: 'F', FlavorBackSpacing: '2', RulesBackSpacing: '4' }),
        // nothing to change
        'c.eon': new DIY({ ...centered, RulesSpacing: '0', FlavorSpacing: '0' }),
    };
    const out = run({ apply: true, after: true, cards });
    assert.deepEqual(out.lines.slice(0, 3), [
        'Changing spacing around centered flavor text:',
        '  a.eon: RulesSpacing 4 -> 0, FlavorSpacing 3 -> 0',
        '  b.eon: FlavorBackSpacing 2 -> 0',
    ]);
    assert.equal(cards['a.eon'].values.FlavorSpacing, '0');
    assert.equal(cards['b.eon'].values.FlavorBackSpacing, '0');
    assert.equal(cards['b.eon'].values.RulesBackSpacing, '4');
    assert.deepEqual(out.written, ['project/a.eon', 'project/b.eon']);
});

test('sides off, without the setting or without flavor, and other cards, are skipped', () => {
    const cards = {
        'unset.eon': new DIY({ Rules: 'R', RulesSpacing: '4', Flavor: 'F' }),
        'off.eon': new DIY({ ...centered, FillFlavor: '0' }),
        'noFlavor.eon': new DIY({ ...centered, Flavor: '' }),
        'zero.eon': new DIY({ ...centered, RulesSpacing: '0' }),
        'other.eon': new DIY(centered, 'res://Other/x.js'),
        'plain.eon': { values: centered },
    };
    const out = run({ apply: false, cards });
    assert.deepEqual(out.lines.slice(1), ['0 card(s) to change.']);
});

test('open cards change in their editors on the event thread; failures are counted', () => {
    const card = new DIY(centered);
    const calls = [];
    const editor = {
        getGameComponent: () => card,
        populateFieldsFromComponent: () => calls.push('populate'),
        forceRerender: () => calls.push('rerender'),
        setUnsavedChanges: v => calls.push('unsaved ' + v),
    };
    const out = run({
        apply: true,
        edt: false,
        cards: { 'open.eon': null, 'missing.eon': null, 'bad.eon': new Error('broken'), 'flavor-spacing-backup/a.eon': new DIY(centered) },
        open: { 'open.eon': [editor] },
    });
    assert.equal(card.values.RulesSpacing, '0');
    assert.deepEqual(calls, ['populate', 'rerender', 'unsaved true']);
    assert.deepEqual(out.written, []);
    assert.deepEqual(out.lines.slice(1), [
        '  open.eon (open): RulesSpacing 4 -> 0',
        '  could not read missing.eon',
        '  failed bad.eon: Error: broken',
        '1 card(s) changed, 2 failed.',
        'Backups of changed files are in flavor-spacing-backup.',
    ]);
    assert.ok(out.waits >= 2);
});

test('without an open project it says so', () => {
    assert.deepEqual(run({ apply: false, cards: {}, noProject: true }).lines, ['Open a project first.']);
});
