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

let openProject = null;
let appWindow = null;
const startupTasks = [];
const Java = {
    type: name => ({
        'ca.cgjennings.apps.arkham.StrangeEons': {
            getOpenProject: () => openProject,
            getWindow: () => appWindow,
            getApplication: () => ({ addStartupTask: task => startupTasks.push(task) }),
        },
    })[name] ?? {},
    extend: (name, methods) => ({ extending: name, ...methods }),
};
const initialized = [];
const caught = [];
const ProjectEvents = load('plugin/ProjectEvents.js', {
    'core/ProjectDefaults': {
        initialize(project) {
            if (project.fails) throw new Error('gone');
            initialized.push(project);
        },
    },
    'se/common': { Eons: { namedObjects: {} } },
    'se/java': Java,
}, { Error: { handleUncaught: ex => caught.push(ex) } });

test('opening a project gives it a layout choice', () => {
    initialized.length = 0;
    const project = {};
    ProjectEvents.opened(project);
    assert.deepEqual(initialized, [project]);
});

test('the listener is added after start up, once, and sees an open project', () => {
    ProjectEvents.register();
    ProjectEvents.register();
    assert.equal(startupTasks.length, 1);
    const task = startupTasks[0];
    assert.equal(task.toString(), 'AHLCG project events');

    // no window: nothing
    task.run();

    const listeners = [];
    appWindow = { addProjectEventListener: l => listeners.push(l) };
    initialized.length = 0;
    task.run();
    assert.equal(listeners.length, 1);
    assert.deepEqual(initialized, []);
    const listener = listeners[0];
    assert.equal(listener.extending, 'ca.cgjennings.apps.arkham.StrangeEonsAppWindow$ProjectEventListener');

    openProject = { name: 'open' };
    task.run();
    assert.deepEqual(initialized, [openProject]);
    const other = {};
    listener.projectOpened(other);
    assert.equal(initialized[1], other);
    listener.projectClosing(other);

    // a failure is reported, not thrown
    listener.projectOpened({ fails: true });
    assert.equal(caught.length, 1);
    openProject = null;
    appWindow = null;
});
