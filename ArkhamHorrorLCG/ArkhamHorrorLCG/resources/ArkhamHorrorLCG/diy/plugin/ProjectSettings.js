// The project's Settings action: a dialog of the faces whose new cards take
// default values from the project, listed on the left as the code editor
// lists its navigator, with the selected face's Game Text controls on the
// right. Values are stored by ProjectDefaults in the project's settings.
//
// Apply to all cards also sets the values on the project's cards that show
// each face, leaving out blank text.
//
// Module: returns { register, Faces, Recorder, getValue, setValue, page,
// applyToProject, edit }.
define([
    'core/ProjectDefaults',
    'faces/EnemyFace',
    'faces/FaceUtils',
    'se/common',
    'se/java',
    'se/strings',
], function (ProjectDefaults, EnemyFace, FaceUtils, common, java, strings) {
    // the faces offered: label key and face
    const Faces = [{ label: 'AHLCG-Face-enemy', face: EnemyFace }];

    // stands in for an editor's bindings: the keys and controls a face's
    // interface binds, in order
    function Recorder() {
        this.entries = [];
    }
    Recorder.prototype.add = function (key, control) {
        this.entries.push({ key: String(key), control: control });
    };

    // a control's value as its card binding stores it
    function getValue(control) {
        if (typeof control.getSelectedItem === 'function') {
            let item = control.getSelectedItem();
            return item == null ? '' : String(item);
        }
        if (typeof control.isSelected === 'function')
            return control.isSelected() ? '1' : '0';
        if (typeof control.getValue === 'function')
            return String(Math.round(Number(control.getValue())));
        return String(control.getText());
    }

    function setValue(control, value) {
        if (typeof control.getSelectedItem === 'function') {
            let model = control.getModel();
            for (let i = 0; i < model.getSize(); i++) {
                if (String(model.getElementAt(i)) === value) {
                    control.setSelectedIndex(i);
                    return;
                }
            }
            return;
        }
        if (typeof control.isSelected === 'function') {
            control.setSelected(['1', 'yes', 'true'].includes(value));
            return;
        }
        if (typeof control.getValue === 'function') {
            control.setValue(java.type('java.lang.Integer').valueOf(value));
            return;
        }
        control.setText(value);
    }

    // a face's page: { face, panel, values(), save( settings ) }, its
    // controls showing the project's values, else the face's own
    function page(Face, settings) {
        var face = new Face();
        var recorder = new Recorder();
        var panel = FaceUtils.createTextPanel(
            face,
            recorder,
            0,
            face.parts,
            '',
            6
        );
        var values = Object.assign(
            face.textDefaults(),
            ProjectDefaults.read(settings, face)
        );
        recorder.entries.forEach(function (entry) {
            if (entry.key in values) setValue(entry.control, values[entry.key]);
        });
        function current() {
            var result = {};
            recorder.entries.forEach(function (entry) {
                result[entry.key] = getValue(entry.control);
            });
            return result;
        }
        return {
            face: face,
            panel: panel,
            values: current,
            save: function (target) {
                ProjectDefaults.write(target, face, current());
            },
        };
    }

    // header of the face list, styled as the code editor's navigator title
    function header() {
        var Theme = java.type('ca.cgjennings.ui.theme.Theme');
        var UIManager = java.type('javax.swing.UIManager');
        var Font = java.type('java.awt.Font');
        var BorderFactory = java.type('javax.swing.BorderFactory');
        var label = new (java.type('javax.swing.JLabel'))(
            strings.string('AHLCG-ProjectSettings-Face-Defaults')
        );
        var font = label.getFont();
        label.setFont(
            font['deriveFont(int,float)'](
                font.getStyle() | Font.BOLD,
                font.getSize() - 2
            )
        );
        label.setBackground(
            UIManager.getColor(Theme.PROJECT_HEADER_BACKGROUND)
        );
        label.setForeground(
            UIManager.getColor(Theme.PROJECT_HEADER_FOREGROUND)
        );
        label.setBorder(BorderFactory.createEmptyBorder(2, 4, 2, 4));
        label.setOpaque(true);
        return label;
    }

    // the dialog content: the face list beside the selected face's page
    function content(pages) {
        var swing = function (name) {
            return java.type('javax.swing.' + name);
        };
        var BorderLayout = java.type('java.awt.BorderLayout');
        var CardLayout = java.type('java.awt.CardLayout');
        var empty = swing('BorderFactory').createEmptyBorder(0, 0, 0, 0);

        var cards = new (swing('JPanel'))(new CardLayout());
        var model = new (swing('DefaultListModel'))();
        pages.forEach(function (p, i) {
            cards.add(p.panel.realize(), String(i));
            model.addElement(strings.string(Faces[i].label));
        });

        var list = new (swing('JList'))(model);
        list.setBorder(empty);
        // a size; a bare number picks the style overload
        var font = list.getFont();
        list.setFont(font['deriveFont(float)'](font.getSize() - 1));
        list.setSelectionMode(swing('ListSelectionModel').SINGLE_SELECTION);
        list.addListSelectionListener(function () {
            var index = list.getSelectedIndex();
            if (index >= 0) cards.getLayout().show(cards, String(index));
        });
        list.setSelectedIndex(0);

        var scroll = new (swing('JScrollPane'))(list);
        scroll.setBorder(empty);
        scroll.setHorizontalScrollBarPolicy(
            swing('ScrollPaneConstants').HORIZONTAL_SCROLLBAR_NEVER
        );
        var side = new (swing('JPanel'))(new BorderLayout());
        side.add(header(), BorderLayout.NORTH);
        side.add(scroll, BorderLayout.CENTER);

        var split = new (swing('JSplitPane'))(
            swing('JSplitPane').HORIZONTAL_SPLIT,
            side,
            cards
        );
        split.setBorder(empty);
        // pixels; a bare number picks the proportional overload
        split['setDividerLocation(int)'](150);
        return split;
    }

    // the card files under a folder
    function cardFiles(folder, files) {
        folder.getChildren().forEach(function (kid) {
            if (kid.isFolder()) cardFiles(kid, files);
            else if (String(kid.getExtension()) === 'eon')
                files.push(kid.getFile());
        });
        return files;
    }

    function applyPages(component, pages) {
        return pages
            .map(function (p) {
                return ProjectDefaults.applyToCard(
                    component,
                    p.face,
                    p.values()
                );
            })
            .some(Boolean);
    }

    // Sets the pages' values on the project's cards; open editors change in
    // place, left unsaved. Returns { changed, failed }.
    function applyToProject(project, pages) {
        var Eons = java.type('ca.cgjennings.apps.arkham.StrangeEons');
        var ResourceKit = common.ResourceKit;
        var result = { changed: 0, failed: 0 };
        cardFiles(project, []).forEach(function (file) {
            try {
                let editors = Eons.getWindow().getEditorsShowingFile(file);
                if (editors.length > 0) {
                    let editor = editors[0];
                    if (!applyPages(editor.getGameComponent(), pages)) return;
                    editor.populateFieldsFromComponent();
                    editor.forceRerender();
                    editor.setUnsavedChanges(true);
                    result.changed++;
                    return;
                }
                let component = ResourceKit.getGameComponentFromFile(
                    file,
                    false
                );
                if (component == null) {
                    result.failed++;
                    return;
                }
                if (!applyPages(component, pages)) return;
                ResourceKit.writeGameComponentToFile(file, component);
                result.changed++;
            } catch (ex) {
                result.failed++;
            }
        });
        return result;
    }

    function reportApplied(result) {
        var message = strings.string(
            'AHLCG-ProjectSettings-Applied',
            String(result.changed)
        );
        if (result.failed > 0)
            message +=
                '\n' +
                strings.string(
                    'AHLCG-ProjectSettings-ApplyFailed',
                    String(result.failed)
                );
        common.alert(message, result.failed > 0);
    }

    // Shows the dialog for the project. OK saves and closes; Apply to all
    // cards saves and applies, leaving it open. Returns whether it saved.
    function edit(project) {
        var JOptionPane = java.type('javax.swing.JOptionPane');
        var JButton = java.type('javax.swing.JButton');
        var Eons = java.type('ca.cgjennings.apps.arkham.StrangeEons');
        var settings = project.getSettings();
        var pages = Faces.map(function (entry) {
            return page(entry.face, settings);
        });
        var saved = false;
        function save() {
            pages.forEach(function (p) {
                p.save(settings);
            });
            project.writeTaskSettings();
            saved = true;
        }

        var ok = strings.string('ok');
        // a button, not a choice, so the pane stays open
        var apply = new JButton(strings.string('AHLCG-ProjectSettings-Apply'));
        apply.addActionListener(function () {
            try {
                save();
                reportApplied(applyToProject(project, pages));
            } catch (ex) {
                Error.handleUncaught(ex);
            }
        });
        var options = [ok, apply, strings.string('cancel')];
        var pane = new JOptionPane(
            content(pages),
            JOptionPane.PLAIN_MESSAGE,
            JOptionPane.DEFAULT_OPTION,
            null,
            options,
            ok
        );
        var dialog = pane.createDialog(
            Eons.getWindow(),
            strings.string('AHLCG-ProjectSettings-Title')
        );
        dialog.setVisible(true);
        dialog.dispose();
        if (String(pane.getValue()) === ok) save();
        return saved;
    }

    function action() {
        return java.extend('ca.cgjennings.apps.arkham.project.TaskAction', {
            getActionName: function () {
                return 'ahlcg-project-settings';
            },
            getLabel: function () {
                return strings.string('AHLCG-ProjectSettings');
            },
            appliesTo: function (project, task, member) {
                return project != null && task == null && member == null;
            },
            perform: function (project, task, member) {
                try {
                    return edit(project);
                } catch (ex) {
                    Error.handleUncaught(ex);
                    return false;
                }
            },
        });
    }

    // once per application; a second initialize finds it registered
    function register() {
        var Actions = java.type('ca.cgjennings.apps.arkham.project.Actions');
        var a = action();
        if (Actions.findActionByName(a.getActionName()) == null)
            Actions.register(a, Actions.PRIORITY_DEFAULT);
    }

    return {
        register: register,
        Faces: Faces,
        Recorder: Recorder,
        getValue: getValue,
        setValue: setValue,
        page: page,
        applyToProject: applyToProject,
        edit: edit,
    };
});
