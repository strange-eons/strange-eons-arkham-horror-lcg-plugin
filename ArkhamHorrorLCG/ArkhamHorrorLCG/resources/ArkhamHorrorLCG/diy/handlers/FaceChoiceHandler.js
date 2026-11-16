// Card handler whose faces are chosen in the editor, from a list per side.
// Each side's choice is stored by id in its setting; a side with one choice
// has no control.
//
// config, as for FaceHandler, and:
//   settings  [ front, back ] setting names that hold the chosen ids; null
//             for a side with one choice
//   choices   [ front, back ] lists of { id, label, face }, in menu order,
//             label being a string key and face a face constructor
//   defaults  [ front, back ] ids of the faces of a new card; the first
//             choice if left out
//   title     string key of the General panel that offers the choices
//   upgradeChoices
//             in place of overriding it
//
// Module: returns FaceChoiceHandler.
define([
    'handlers/FaceHandler',
    'se/strings',
    'se/ui',
    'se/java',
    'require',
], function (FaceHandler, strings, ui, Java, require) {
    const ListItem = Java.type('ca.cgjennings.apps.arkham.diy.ListItem');
    function FaceChoiceHandler(config) {
        this.choices = config.choices;
        this.faceSettings = config.settings;
        this.panelTitle = config.title;
        this.defaults = this.choices.map(function (list, faceIndex) {
            return config.defaults ? config.defaults[faceIndex] : list[0].id;
        });

        FaceHandler.call(
            this,
            config,
            new (this.findChoice(0, this.defaults[0]).face)(),
            new (this.findChoice(1, this.defaults[1]).face)()
        );

        this.faceIds = this.defaults.slice();
        // the component, for entry points that are not passed one
        this.component = null;
    }

    FaceChoiceHandler.prototype = Object.create(FaceHandler.prototype);
    FaceChoiceHandler.prototype.constructor = FaceChoiceHandler;

    // the choice with the id, or null
    FaceChoiceHandler.prototype.findChoice = function (faceIndex, id) {
        var list = this.choices[faceIndex];
        for (let i = 0; i < list.length; i++) {
            if (list[i].id === id) return list[i];
        }
        return null;
    };

    // the chosen id, or the default if the setting holds another
    FaceChoiceHandler.prototype.getFaceSetting = function (diy, faceIndex) {
        if (this.faceSettings[faceIndex] == null)
            return this.defaults[faceIndex];
        var id = String(
            diy.settings.get(
                this.faceSettings[faceIndex],
                this.defaults[faceIndex]
            )
        );
        return this.findChoice(faceIndex, id) != null
            ? id
            : this.defaults[faceIndex];
    };

    // Applies the chosen faces: faces, missing defaults and templates.
    FaceChoiceHandler.prototype.applyFaceSettings = function (diy) {
        for (let i = 0; i < this.faces.length; i++) {
            let id = this.getFaceSetting(diy, i);
            if (this.faceIds[i] !== id) {
                this.faces[i].clearType(diy, i);
                this.setFace(i, new (this.findChoice(i, id).face)());
                this.faceIds[i] = id;
            }
            this.faces[i].setDefaults(diy, i, true);
        }
        this.setFaceTemplates(diy);
        this.updateCollector(diy);
    };

    // brings the faces in line with the settings after they change outside
    // the editor
    FaceChoiceHandler.prototype.syncFaces = function () {
        if (this.component == null) return;

        for (let i = 0; i < this.faces.length; i++) {
            if (this.faceIds[i] !== this.getFaceSetting(this.component, i)) {
                this.applyFaceSettings(this.component);
                return;
            }
        }
    };

    FaceChoiceHandler.prototype.createGeneralPanels = function (
        diy,
        editor,
        bindings
    ) {
        var handler = this;
        var panel = new ui.Grid();
        panel.setTitle(strings.string(this.panelTitle));

        var labels = [
            strings.string('AHLCG-Front'),
            strings.string('AHLCG-Back'),
        ];
        var offered = 0;
        for (let i = 0; i < this.faceSettings.length; i++) {
            let faceIndex = i;
            let list = this.choices[faceIndex];
            if (list.length < 2) continue;
            offered++;

            let items = list.map(function (choice) {
                return new ListItem(choice.id, strings.string(choice.label));
            });
            let combo = new ui.comboBox(items, null);
            combo.setSelectedIndex(
                list.indexOf(
                    this.findChoice(faceIndex, this.faceIds[faceIndex])
                )
            );
            combo.addActionListener(function selectFace(actionEvent) {
                try {
                    let id = String(combo.getSelectedItem());
                    if (id === handler.faceIds[faceIndex]) return;

                    handler.changeFace(diy, faceIndex, function () {
                        diy.settings.set(handler.faceSettings[faceIndex], id);
                        handler.applyFaceSettings(diy);
                    });
                } catch (ex) {
                    Error.handleUncaught(ex);
                }
            });

            panel.place(
                labels[faceIndex],
                'align right',
                combo,
                'wrap, pushx, growx'
            );
        }

        return offered > 0 ? [panel] : [];
    };

    FaceChoiceHandler.prototype.create = function (diy) {
        this.component = diy;

        for (let i = 0; i < this.faceSettings.length; i++) {
            if (this.faceSettings[i] != null)
                diy.settings.set(this.faceSettings[i], this.defaults[i]);
        }
        this.applyFaceSettings(diy);

        FaceHandler.prototype.create.call(this, diy);
    };

    // An older save's choices are upgraded before its faces are applied; the
    // other upgrades see those faces.
    FaceChoiceHandler.prototype.onRead = function (diy, ois) {
        this.component = diy;
        if (diy.version < this.version) this.upgradeChoices(diy);
        this.applyFaceSettings(diy);

        FaceHandler.prototype.onRead.call(this, diy, ois);
    };

    // Subclasses may override upgradeChoices( diy ) to set the face settings
    // of an older save.
    FaceChoiceHandler.prototype.upgradeChoices = function (diy) {
        if (this.config.upgradeChoices) this.config.upgradeChoices(diy);
    };

    // the face settings too
    FaceChoiceHandler.prototype.componentSettingKeys = function () {
        return FaceHandler.prototype.componentSettingKeys.call(this).concat(
            this.faceSettings.filter(function (key) {
                return key != null;
            })
        );
    };

    // A converted card's settings choose its faces. Portraits are matched to
    // the source's by key, as their order can differ. A conversion that
    // composes faces of other cards then brings them in (see
    // handlers/FaceComposer).
    FaceChoiceHandler.prototype.onConvertTo = function (diy, session) {
        this.component = diy;
        this.applyFaceSettings(diy);

        var source = session.getSource();
        var sourceIndex = {};
        for (let i = 0; i < source.getPortraitCount(); i++) {
            let portrait = source.getPortrait(i);
            if (typeof portrait.getBaseKey === 'function')
                sourceIndex[String(portrait.getBaseKey())] = i;
        }
        this.allPortraits().forEach(function (portrait, j) {
            var i = sourceIndex[String(portrait.getBaseKey())];
            if (i !== undefined) session.copyPortrait(i, j, true);
        });
        session.disableAutomaticCopyPortraits();

        var FaceComposer = require('handlers/FaceComposer');
        if (FaceComposer.isComposing(session))
            FaceComposer.compose(this, diy, session);
    };

    // the entry points below first apply face settings changed outside the
    // editor

    FaceChoiceHandler.prototype.getPortraitCount = function () {
        this.syncFaces();
        return FaceHandler.prototype.getPortraitCount.call(this);
    };

    FaceChoiceHandler.prototype.createInterface = function (diy, editor) {
        this.syncFaces();
        FaceHandler.prototype.createInterface.call(this, diy, editor);
    };

    FaceChoiceHandler.prototype.createFacePainter = function (
        diy,
        sheet,
        faceIndex
    ) {
        this.syncFaces();
        FaceHandler.prototype.createFacePainter.call(
            this,
            diy,
            sheet,
            faceIndex
        );
    };

    FaceChoiceHandler.prototype.paintFace = function (g, diy, sheet) {
        this.syncFaces();
        FaceHandler.prototype.paintFace.call(this, g, diy, sheet);
    };

    return FaceChoiceHandler;
});
