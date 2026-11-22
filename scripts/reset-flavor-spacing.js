/*
 * Sets the spacing before flavor text to 0 on the open project's AHLCG
 * cards whose flavor text is centered vertically.
 *
 * A side counts when its "Center flavor text vertically" box is checked.
 * Only sides with flavor text are changed. The spacing before flavor is the
 * spacing after the nearest text above it (Rules, Keywords or Traits); the
 * spacing of empty fields between them is left alone. With AFTER_FLAVOR true,
 * the spacing after the flavor text is set to 0 as well.
 *
 * Run from the Quickscript window, or with Run on the script in the project,
 * with a project open. It changes nothing
 * until APPLY is true: run it once to see the list, then set APPLY to true
 * and run again. Changed files are copied to BACKUP_FOLDER in the project
 * first. Cards open in an editor are changed there and left unsaved.
 */

var APPLY = false;

var AFTER_FLAVOR = false;

var BACKUP_FOLDER = 'flavor-spacing-backup';

importClass(java.io.File);
importClass(Packages.ca.cgjennings.apps.arkham.project.ProjectUtilities);
importClass(java.awt.EventQueue);

// the fields that can come before flavor text, top to bottom
var ABOVE_FLAVOR = ['Traits', 'Keywords', 'Rules'];
var SIDES = ['', 'Back'];

function isOn(value) {
    return ['1', 'yes', 'true'].indexOf(String(value).toLowerCase()) >= 0;
}

function isAhlcg(gc) {
    return (
        gc instanceof Packages.ca.cgjennings.apps.arkham.diy.DIY &&
        /^(res:\/\/)?ArkhamHorrorLCG\//.test(String(gc.getHandlerScript()))
    );
}

function text(settings, key) {
    var v = settings.get(key);
    return v == null ? '' : String(v);
}

// [ key, value ] if the key's spacing is above 0
function spaced(settings, key) {
    var spacing = settings.get(key);
    return spacing != null && Number(spacing) > 0 ? [[key, String(spacing)]] : [];
}

// the spacing keys next to the side's flavor text that are above 0, as
// [ key, value ] pairs; none unless the side centers its flavor text
function spacingAroundFlavor(settings, side) {
    if (
        !isOn(settings.get('FillFlavor' + side)) ||
        text(settings, 'Flavor' + side) === ''
    )
        return [];
    var found = [];
    for (var i = ABOVE_FLAVOR.length - 1; i >= 0; --i) {
        var part = ABOVE_FLAVOR[i] + side;
        if (text(settings, part) === '') continue;
        found = spaced(settings, part + 'Spacing');
        break;
    }
    if (AFTER_FLAVOR)
        found = found.concat(spaced(settings, 'Flavor' + side + 'Spacing'));
    return found;
}

function changesFor(gc) {
    var changes = [];
    for (var s = 0; s < SIDES.length; ++s) {
        changes = changes.concat(
            spacingAroundFlavor(gc.getSettings(), SIDES[s])
        );
    }
    return changes;
}

function setZero(gc, changes) {
    for (var i = 0; i < changes.length; ++i)
        gc.getSettings().set(changes[i][0], '0');
}

function onEdt(fn) {
    if (EventQueue.isDispatchThread()) return fn();
    var result;
    EventQueue.invokeAndWait(function () {
        result = fn();
    });
    return result;
}

function cardFiles(member, files) {
    var kids = member.getChildren();
    for (var i = 0; i < kids.length; ++i) {
        if (kids[i].isFolder()) cardFiles(kids[i], files);
        else if (String(kids[i].getExtension()) === 'eon')
            files.push(kids[i].getFile());
    }
    return files;
}

function backup(project, file) {
    var root = project.getFile().toPath();
    var target = new File(project.getFile(), BACKUP_FOLDER)
        .toPath()
        .resolve(root.relativize(file.toPath()))
        .toFile();
    target.getParentFile().mkdirs();
    ProjectUtilities.copyFile(file, target);
}

function describe(changes) {
    return changes
        .map(function (c) {
            return c[0] + ' ' + c[1] + ' -> 0';
        })
        .join(', ');
}

function run() {
    var project = Eons.getOpenProject();
    if (project == null) {
        println('Open a project first.');
        return;
    }
    var root = project.getFile().toPath();
    var files = cardFiles(project, []);
    var changed = 0;
    var failed = 0;
    println(
        (APPLY ? 'Changing' : 'Would change (APPLY is false)') +
            ' spacing ' +
            (AFTER_FLAVOR ? 'around' : 'before') +
            ' centered flavor text:'
    );
    for (var i = 0; i < files.length; ++i) {
        var file = files[i];
        var name = String(root.relativize(file.toPath()));
        if (name.indexOf(BACKUP_FOLDER + File.separator) === 0) continue;
        try {
            var editors = onEdt(function () {
                return Eons.getWindow().getEditorsShowingFile(file);
            });
            var editor = editors.length > 0 ? editors[0] : null;
            var gc =
                editor != null
                    ? editor.getGameComponent()
                    : ResourceKit.getGameComponentFromFile(file, false);
            if (gc == null) {
                println('  could not read ' + name);
                ++failed;
                continue;
            }
            if (!isAhlcg(gc)) continue;
            var changes = changesFor(gc);
            if (changes.length === 0) continue;
            println(
                '  ' +
                    name +
                    (editor != null ? ' (open)' : '') +
                    ': ' +
                    describe(changes)
            );
            ++changed;
            if (!APPLY) continue;
            if (editor != null) {
                onEdt(function () {
                    setZero(gc, changes);
                    editor.populateFieldsFromComponent();
                    editor.forceRerender();
                    editor.setUnsavedChanges(true);
                });
            } else {
                backup(project, file);
                setZero(gc, changes);
                ResourceKit.writeGameComponentToFile(file, gc);
            }
        } catch (ex) {
            println('  failed ' + name + ': ' + ex);
            ++failed;
        }
    }
    println(
        changed +
            ' card(s) ' +
            (APPLY ? 'changed' : 'to change') +
            (failed > 0 ? ', ' + failed + ' failed' : '') +
            '.'
    );
    if (APPLY && changed > 0) {
        println('Backups of changed files are in ' + BACKUP_FOLDER + '.');
        project.synchronize();
    }
}

run();
