// The project's Settings action: a dialog of pages listed on the left in
// sections, as the code editor lists its navigator, with the selected page on
// the right. Face Defaults holds the Layout page, the project's choice for
// new cards (see ProjectDefaults).
//
// Apply to all cards also sets the layout choice on the project's cards that
// show each face that has it.
//
// Module: returns { register, Faces, layoutPage, applyToProject, edit }.
define([
    'core/ProjectDefaults',
    'handlers/FlexibleFaces',
    'se/common',
    'se/java',
    'se/strings',
    'se/ui',
], function (ProjectDefaults, FlexibleFaces, common, java, strings, ui) {
    // the faces whose cards follow the layout choice
    const Faces = FlexibleFaces.choices
        .map(function (choice) {
            return choice.face;
        })
        .filter(function (Face) {
            return Face.prototype.fillsFlavor();
        });

    // { label, panel, save( settings ), applyToCard( component ) }: the
    // project's layout choice
    function layoutPage(settings) {
        var faces = Faces.map(function (Face) {
            return new Face();
        });
        var check = new ui.checkBox(
            strings.string('AHLCG-FillFlavor'),
            ProjectDefaults.enabled(settings)
        );
        var panel = new ui.Grid();
        panel.setTitle(strings.string('AHLCG-ProjectSettings-Layout'));
        panel.place(check, 'wrap');
        return {
            label: 'AHLCG-ProjectSettings-Layout',
            panel: panel,
            save: function (target) {
                ProjectDefaults.setEnabled(target, check.isSelected());
            },
            applyToCard: function (component) {
                return faces
                    .map(function (face) {
                        return ProjectDefaults.applyToCard(
                            component,
                            face,
                            check.isSelected()
                        );
                    })
                    .some(Boolean);
            },
        };
    }

    // a section header, styled as the code editor's navigator title
    function header(title) {
        var Theme = java.type('ca.cgjennings.ui.theme.Theme');
        var UIManager = java.type('javax.swing.UIManager');
        var Font = java.type('java.awt.Font');
        var BorderFactory = java.type('javax.swing.BorderFactory');
        var label = new (java.type('javax.swing.JLabel'))(
            strings.string(title)
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

    // lets a component in a box layout take the box's width
    function fullWidth(component) {
        component.setMaximumSize(
            new (java.type('java.awt.Dimension'))(
                java.type('java.lang.Integer').MAX_VALUE,
                component.getPreferredSize().height
            )
        );
    }

    // The dialog content: each section's header and page list, one page
    // selected among them all, left of the selected page. sections are
    // [ { title, pages } ].
    function content(sections) {
        var swing = function (name) {
            return java.type('javax.swing.' + name);
        };
        var BorderLayout = java.type('java.awt.BorderLayout');
        var CardLayout = java.type('java.awt.CardLayout');
        var Component = java.type('java.awt.Component');
        var BoxLayout = swing('BoxLayout');
        var empty = swing('BorderFactory').createEmptyBorder(0, 0, 0, 0);

        var cards = new (swing('JPanel'))(new CardLayout());
        var side = new (swing('JPanel'))();
        side.setLayout(new BoxLayout(side, BoxLayout.PAGE_AXIS));
        var lists = [];
        sections.forEach(function (section, s) {
            let model = new (swing('DefaultListModel'))();
            section.pages.forEach(function (p, i) {
                cards.add(p.panel.realize(), s + '-' + i);
                model.addElement(strings.string(p.label));
            });
            let list = new (swing('JList'))(model);
            list.setBorder(empty);
            // a size; a bare number picks the style overload
            let font = list.getFont();
            list.setFont(font['deriveFont(float)'](font.getSize() - 1));
            list.setSelectionMode(swing('ListSelectionModel').SINGLE_SELECTION);
            list.setAlignmentX(Component.LEFT_ALIGNMENT);
            list.addListSelectionListener(function () {
                var index = list.getSelectedIndex();
                if (index < 0) return;
                lists.forEach(function (other) {
                    if (other !== list) other.clearSelection();
                });
                cards.getLayout().show(cards, s + '-' + index);
            });
            lists.push(list);
            let title = header(section.title);
            title.setAlignmentX(Component.LEFT_ALIGNMENT);
            fullWidth(title);
            fullWidth(list);
            side.add(title);
            side.add(list);
        });
        lists[0].setSelectedIndex(0);
        // the lists' background below and beside them
        side.setBackground(lists[0].getBackground());

        // the lists at their own width, the pages taking the rest
        var root = new (swing('JPanel'))(new BorderLayout());
        root.add(side, BorderLayout.WEST);
        root.add(cards, BorderLayout.CENTER);
        return root;
    }

    // the card file members under a folder
    function cardMembers(folder, members) {
        folder.getChildren().forEach(function (kid) {
            if (kid.isFolder()) cardMembers(kid, members);
            else if (String(kid.getExtension()) === 'eon') members.push(kid);
        });
        return members;
    }

    function applyPages(component, pages) {
        return pages
            .map(function (p) {
                return p.applyToCard(component);
            })
            .some(Boolean);
    }

    // calls fn on the event dispatch thread, waiting for it; returns its
    // result
    function onEdt(fn) {
        var SwingUtilities = java.type('javax.swing.SwingUtilities');
        if (SwingUtilities.isEventDispatchThread()) return fn();
        var result;
        SwingUtilities.invokeAndWait(function () {
            result = fn();
        });
        return result;
    }

    // Applies the pages to the card in the editor showing the file, left
    // unsaved. Returns null when no editor shows it, else whether it changed.
    function applyInEditor(file, pages) {
        var Eons = java.type('ca.cgjennings.apps.arkham.StrangeEons');
        var editors = Eons.getWindow().getEditorsShowingFile(file);
        if (editors.length === 0) return null;
        var editor = editors[0];
        if (!applyPages(editor.getGameComponent(), pages)) return false;
        editor.populateFieldsFromComponent();
        editor.forceRerender();
        editor.setUnsavedChanges(true);
        return true;
    }

    // Sets the pages' choices on the project's cards; open editors change in
    // place, left unsaved. progress( done, total, name ), if given, is called
    // before each card. Returns { changed, failed }.
    function applyToProject(project, pages, progress) {
        var ResourceKit = common.ResourceKit;
        var result = { changed: 0, failed: 0 };
        var members = cardMembers(project, []);
        members.forEach(function (member, index) {
            if (progress)
                progress(index, members.length, String(member.getName()));
            let file = member.getFile();
            try {
                let edited = onEdt(function () {
                    return applyInEditor(file, pages);
                });
                if (edited !== null) {
                    if (edited) result.changed++;
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

    // applyToProject off the event dispatch thread, behind a busy dialog
    // that shows its progress; returns when it is done
    function applyWithProgress(project, pages) {
        var BusyDialog = java.type('ca.cgjennings.apps.arkham.BusyDialog');
        var result = null;
        var error = null;
        function progress(done, total, name) {
            if (done === 0) BusyDialog.maximumProgress(total);
            BusyDialog.currentProgress(done);
            BusyDialog.statusText(name);
        }
        new BusyDialog(
            strings.string('AHLCG-ProjectSettings-Applying'),
            function () {
                try {
                    result = applyToProject(project, pages, progress);
                } catch (ex) {
                    error = ex;
                }
            }
        );
        if (error !== null) throw error;
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
    // present( dialog ), if given, stands in for showing the modal dialog,
    // as a test does to use it unseen.
    function edit(project, present) {
        var JOptionPane = java.type('javax.swing.JOptionPane');
        var JButton = java.type('javax.swing.JButton');
        var Eons = java.type('ca.cgjennings.apps.arkham.StrangeEons');
        var settings = project.getSettings();
        var pages = [layoutPage(settings)];
        var saved = false;
        function save() {
            pages.forEach(function (p) {
                p.save(settings);
            });
            project.writeTaskSettings();
            saved = true;
        }

        // a JS string: the engine gives Java strings as objects
        var ok = String(strings.string('ok'));
        // a button, not a choice, so the pane stays open
        var apply = new JButton(strings.string('AHLCG-ProjectSettings-Apply'));
        apply.addActionListener(function () {
            try {
                save();
                reportApplied(applyWithProgress(project, pages));
            } catch (ex) {
                Error.handleUncaught(ex);
            }
        });
        var options = [ok, apply, strings.string('cancel')];
        var pane = new JOptionPane(
            content([
                { title: 'AHLCG-ProjectSettings-Face-Defaults', pages: pages },
            ]),
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
        if (present) present(dialog);
        else dialog.setVisible(true);
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
        layoutPage: layoutPage,
        applyToProject: applyToProject,
        edit: edit,
    };
});
