// Card handler that dispatches to a front and back face (diy/faces).
// Subclasses pass their configuration and faces to the constructor and export
// an instance with handlers/exportHandler.
//
// diy.version is handlers/CardVersion, written on create and read.
//
// config:
//   templateKeys  [ front, back ] template keys of the component; each face's
//                 template settings are copied to them, since the component's
//                 template keys can't change after create
//   cardDefaults  settings a new card starts with, over the faces' own
//   legacyPortraits, upgrade
//                 for a legacy card type, in place of overriding them
//   upgradeArt    function( diy, art ) run after an older save's portraits
//                 are read; art[faceIndex] lists each face's art portraits
//
// Subclasses may override setCardDefaults( diy ) for extra card-level
// defaults, upgrade( diy ) for version steps when reading older saves, before
// the portraits are read and while diy.version is the saved version,
// legacyPortraits( diy ) for the portraits a legacy save holds, and
// createGeneralPanels( diy, editor, bindings ).
//
// Module: returns FaceHandler.
define([
    'handlers/CardVersion',
    'handlers/Collector',
    'handlers/TemplateReplacement',
    'faces/FaceUtils',
    'se/diy',
    'se/imageutils',
    'se/strings',
    'se/ui',
    'ui/Bindings',
    'se/java',
], function (
    CardVersion,
    Collector,
    TemplateReplacement,
    FaceUtils,
    diyLibrary,
    imageutils,
    strings,
    ui,
    Bindings,
    Java
) {
    const PropertyChangeListener = Java.type(
        'java.beans.PropertyChangeListener'
    );
    const DefaultPortrait = Java.type(
        'ca.cgjennings.apps.arkham.component.DefaultPortrait'
    );
    const FACE_FRONT = 0;
    const FACE_BACK = 1;
    const GeneralHint = 'wrap, pushx, growx';

    function FaceHandler(config, front, back) {
        this.version = CardVersion;
        this.templateKeys = config.templateKeys;
        this.config = config;

        this.faces = [front, back];
        this.boxes = [null, null];
        // each side's art portraits, in the order of its face's portraits
        this.art = [[], []];
        // the kinds of set the faces draw, and a portrait for each custom icon
        this.portraitKinds = [];
        this.portraits = [];

        // the open editor: its bindings, General tab panel and tab, and what
        // each side added to them
        this.editor = null;
        this.bindings = null;
        this.generalPanel = null;
        this.generalTab = null;
        this.sideInterfaces = [null, null];
        this.artTab = null;
        this.collectorTabs = [];
        this.copyright = null;
        this.templatePanel = null;
    }

    FaceHandler.prototype.setFace = function (faceIndex, face) {
        this.faces[faceIndex] = face;
        this.boxes[faceIndex] = null;
    };

    FaceHandler.prototype.setCardDefaults = function (diy) {
        var values = this.config.cardDefaults || {};
        for (let key in values) diy.settings.set(key, values[key]);
    };

    FaceHandler.prototype.upgrade = function (diy) {
        if (this.config.upgrade && diy.version < this.version)
            this.config.upgrade(diy);
    };

    FaceHandler.prototype.setFaceTemplates = function (diy) {
        for (let i = 0; i < this.faces.length; i++) {
            let face = this.faces[i];
            let key = this.templateKeys[i];
            diy.settings.set(
                key + '-template',
                diy.settings.get(face.template + '-template')
            );
            diy.settings.set(key + '-bleed-margin', String(face.bleedMargin));
            if (face.dpi != null)
                diy.settings.set(key + '-dpi', String(face.dpi));
            else diy.settings.reset(key + '-dpi');
        }
    };

    // panels placed first on the General tab
    FaceHandler.prototype.createGeneralPanels = function (
        diy,
        editor,
        bindings
    ) {
        return [];
    };

    FaceHandler.prototype.usesKind = function (faceIndex, kind) {
        return kind === 'Collection'
            ? this.faces[faceIndex].usesCollection
            : this.faces[faceIndex].usesEncounter;
    };

    FaceHandler.prototype.showsCollectionNumber = function (faceIndex) {
        var face = this.faces[faceIndex];
        return face.usesCollection && face.showsCollectionNumber;
    };

    FaceHandler.prototype.createArtPortrait = function (diy, key, faceIndex) {
        var portrait = new DefaultPortrait(diy, key, true);
        // the back's also updates the front, as the portrait panel needs
        portrait.facesToUpdate =
            faceIndex === FACE_FRONT ? [FACE_FRONT] : [FACE_FRONT, FACE_BACK];
        portrait.backgroundFilled = true;
        portrait.installDefault();
        return portrait;
    };

    // Matches the art portraits to what the faces draw. Portraits still in
    // use are kept.
    FaceHandler.prototype.updateArt = function (diy) {
        this.art = this.faces.map(function (face, faceIndex) {
            var current = this.art[faceIndex];
            return face.portraits.map(function (name) {
                let key = face.portraitKey(faceIndex, name);
                let kept = current.filter(function (portrait) {
                    return String(portrait.getBaseKey()) === key;
                });
                return kept.length > 0
                    ? kept[0]
                    : this.createArtPortrait(diy, key, faceIndex);
            }, this);
        }, this);
    };

    // art portraits first, front then back, then those of the sets
    FaceHandler.prototype.allPortraits = function () {
        return this.art[FACE_FRONT].concat(this.art[FACE_BACK], this.portraits);
    };

    // the portrait of a kind of set, or null
    FaceHandler.prototype.findPortrait = function (kind) {
        var index = this.portraitKinds.indexOf(kind);
        return index < 0 ? null : this.portraits[index];
    };

    // The region a custom encounter icon's scale is set against: the front's
    // icon region, or the back's when the front has none. Other faces draw
    // the icon scaled from it to their own region.
    FaceHandler.prototype.encounterReference = function (diy) {
        for (var i = FACE_FRONT; i <= FACE_BACK; i++) {
            let face = this.faces[i];
            if (
                face != null &&
                diy.settings.get(
                    face.key(diy.settings, 'EncounterIcon-region')
                ) != null
            )
                return face.collectorRegion(diy, 'EncounterIcon');
        }
        return null;
    };

    FaceHandler.prototype.createPortrait = function (diy, kind) {
        var portrait = new DefaultPortrait(diy, 'AHLCG-Face-' + kind, true);
        portrait.facesToUpdate = [FACE_FRONT, FACE_BACK];
        portrait.backgroundFilled = false;
        portrait.installDefault();
        return portrait;
    };

    // Matches the portraits and set settings to what the faces draw. Portraits
    // still in use are kept.
    FaceHandler.prototype.updateCollector = function (diy) {
        this.updateArt(diy);
        var kinds = ['Collection', 'Encounter'].filter(function (kind) {
            return (
                this.usesKind(FACE_FRONT, kind) ||
                this.usesKind(FACE_BACK, kind)
            );
        }, this);
        var portraits = kinds.map(function (kind) {
            return this.findPortrait(kind) || this.createPortrait(diy, kind);
        }, this);

        this.portraitKinds = kinds;
        this.portraits = portraits;
        kinds.forEach(function (kind, i) {
            Collector.setDefaults(diy, kind, portraits[i]);
        });
        if (this.copyrightFaces().length > 0) {
            Collector.setCopyrightDefaults(diy, true);
        }
        if (this.templateReplacementFaces().length > 0) {
            TemplateReplacement.setDefaults(diy, true);
        }
    };

    // the sides that offer an image to replace the template
    FaceHandler.prototype.templateReplacementFaces = function () {
        return [FACE_FRONT, FACE_BACK].filter(function (faceIndex) {
            return this.faces[faceIndex].usesTemplateReplacement;
        }, this);
    };

    // the sides that draw the card's copyright
    FaceHandler.prototype.copyrightFaces = function () {
        return [FACE_FRONT, FACE_BACK].filter(function (faceIndex) {
            return this.faces[faceIndex].usesCopyright;
        }, this);
    };

    // Adds a tab for each kind of set a face draws, after the sides' tabs, and
    // the copyright and template replacement panels, after the sides' panels,
    // if a face uses them.
    FaceHandler.prototype.addCollectorInterface = function (diy) {
        var tabPane = this.editor.getTabbedPane();
        var index = this.collectorTabIndex();

        this.portraitKinds.forEach(function (kind, i) {
            let faces = [FACE_FRONT, FACE_BACK].filter(function (faceIndex) {
                return this.usesKind(faceIndex, kind);
            }, this);
            let tab = Collector.createTab(
                diy,
                this.bindings,
                kind,
                this.art[FACE_FRONT].length + this.art[FACE_BACK].length + i,
                this.portraits[i],
                faces
            );
            tab.panel.editorTabScrolling = true;
            tab.panel.addToEditor(
                this.editor,
                tab.title,
                null,
                null,
                index + i
            );
            this.collectorTabs.push({
                kind: kind,
                title: tab.title,
                component: tabPane.getComponentAt(index + i),
                controls: tab.controls,
            });
        }, this);
        this.updateCollectorTabs(diy);

        var copyrightFaces = this.copyrightFaces();
        if (copyrightFaces.length > 0) {
            let copyright = Collector.createCopyrightPanel(
                this.bindings,
                copyrightFaces
            );
            let panel = copyright.panel.realize();
            this.generalPanel['add(java.awt.Component,java.lang.Object)'](
                panel,
                GeneralHint
            );
            this.copyright = { component: panel, controls: copyright.controls };
        }

        var templateFaces = this.templateReplacementFaces();
        if (templateFaces.length > 0) {
            let template = TemplateReplacement.createPanel(
                this.bindings,
                templateFaces
            );
            let panel = template.panel.realize();
            this.generalPanel['add(java.awt.Component,java.lang.Object)'](
                panel,
                GeneralHint
            );
            this.templatePanel = {
                component: panel,
                controls: template.controls,
            };
        }
    };

    // whether a side draws the encounter set as the card's settings stand
    FaceHandler.prototype.showsEncounterTab = function (diy) {
        return [FACE_FRONT, FACE_BACK].some(function (faceIndex) {
            return this.faces[faceIndex].showsEncounterTab(diy, faceIndex);
        }, this);
    };

    // Shows the encounter set tab only while a side draws the set; the tab
    // stays at its place after the collection tab.
    FaceHandler.prototype.updateCollectorTabs = function (diy) {
        if (this.editor == null) return;
        var tabPane = this.editor.getTabbedPane();
        var previous = null;
        this.collectorTabs.forEach(function (tab) {
            var shown = tabPane.indexOfComponent(tab.component) >= 0;
            var wanted =
                tab.kind !== 'Encounter' || this.showsEncounterTab(diy);
            if (shown && !wanted) {
                if (tabPane.getSelectedComponent() === tab.component)
                    tabPane.setSelectedIndex(0);
                tabPane.remove(tab.component);
            } else if (!shown && wanted) {
                let index =
                    previous != null
                        ? tabPane.indexOfComponent(previous.component) + 1
                        : this.collectorTabIndex();
                tabPane.insertTab(tab.title, null, tab.component, null, index);
            }
            if (wanted) previous = tab;
        }, this);
    };

    // where the first collector tab goes, after the sides' tabs
    FaceHandler.prototype.collectorTabIndex = function () {
        var tabPane = this.editor.getTabbedPane();
        return (
            tabPane.indexOfComponent(this.generalTab) +
            1 +
            this.sideInterfaces[FACE_FRONT].tabs.length +
            this.sideInterfaces[FACE_BACK].tabs.length +
            (this.artTab == null ? 0 : 1)
        );
    };

    FaceHandler.prototype.removeCollectorInterface = function () {
        var tabPane = this.editor.getTabbedPane();
        this.collectorTabs.forEach(function (tab) {
            tab.controls.forEach(function (control) {
                this.bindings.remove(control);
            }, this);
            tabPane.remove(tab.component);
        }, this);
        this.collectorTabs = [];

        [this.copyright, this.templatePanel].forEach(function (panel) {
            if (panel == null) return;
            panel.controls.forEach(function (control) {
                this.bindings.remove(control);
            }, this);
            this.generalPanel.remove(panel.component);
        }, this);
        this.copyright = null;
        this.templatePanel = null;
    };

    FaceHandler.prototype.getPortraitCount = function () {
        return this.allPortraits().length;
    };

    FaceHandler.prototype.getPortrait = function (index) {
        var portraits = this.allPortraits();
        if (index < 0 || index >= portraits.length) {
            throw new Error('Invalid portrait index: ' + index);
        }
        return portraits[index];
    };

    FaceHandler.prototype.create = function (diy) {
        this.setFaceTemplates(diy);
        diy.frontTemplateKey = this.templateKeys[FACE_FRONT];
        diy.backTemplateKey = this.templateKeys[FACE_BACK];

        diy.faceStyle = diyLibrary.FaceStyle.TWO_FACES;
        diy.customPortraitHandling = true;

        diy.name = '';

        this.setDefaults(diy);

        diy.setCornerRadius(8);
        diy.version = this.version;
    };

    FaceHandler.prototype.setDefaults = function (diy) {
        for (let i = 0; i < this.faces.length; i++) {
            this.faces[i].setDefaults(diy, i, false);
        }

        this.setCardDefaults(diy);
        if (this.copyrightFaces().length > 0) {
            Collector.setCopyrightDefaults(diy, false);
        }
        if (this.templateReplacementFaces().length > 0) {
            TemplateReplacement.setDefaults(diy, false);
        }
        this.updateCollector(diy);
    };

    FaceHandler.prototype.createInterface = function (diy, editor) {
        var tabPane = editor.getTabbedPane();

        this.editor = editor;
        this.bindings = new Bindings(editor, diy);

        var GeneralTab = new ui.Grid();
        GeneralTab.editorTabScrolling = true;
        var general = this.createGeneralPanels(diy, editor, this.bindings);
        for (let i = 0; i < general.length; i++) {
            GeneralTab.place(general[i], GeneralHint);
        }
        this.generalPanel = GeneralTab.addToEditor(
            editor,
            strings.string('AHLCG-General')
        );
        // added before the last tab
        this.generalTab = tabPane.getComponentAt(tabPane.getTabCount() - 2);

        for (let faceIndex = 0; faceIndex < this.faces.length; faceIndex++) {
            this.addFaceInterface(diy, faceIndex);
        }
        this.addArtInterface(diy);
        this.addCollectorInterface(diy);

        this.bindings.bind();

        // a change of template or class can hide or show the encounter set
        var handler = this;
        if (this.settingsListener != null)
            diy.settings.removePropertyChangeListener(this.settingsListener);
        this.settingsListener = new PropertyChangeListener({
            propertyChange: function () {
                try {
                    handler.updateCollectorTabs(diy);
                } catch (ex) {
                    Error.handleUncaught(ex);
                }
            },
        });
        diy.settings.addPropertyChangeListener(this.settingsListener);
    };

    // Adds a side's panels to the General tab and its tabs after the General
    // tab, before those of the back.
    FaceHandler.prototype.addFaceInterface = function (diy, faceIndex) {
        var tabPane = this.editor.getTabbedPane();
        var faceUi = this.faces[faceIndex].createInterface(
            diy,
            this.bindings,
            faceIndex
        );
        var side = { general: [], tabs: [] };
        var sideName = strings.string(
            faceIndex === FACE_FRONT ? 'AHLCG-Front' : 'AHLCG-Back'
        );
        var back =
            faceIndex === FACE_FRONT ? this.sideInterfaces[FACE_BACK] : null;

        var generalIndex =
            this.generalPanel.getComponentCount() -
            (back ? back.general.length : 0);
        for (let j = 0; j < faceUi.general.length; j++) {
            faceUi.general[j].panel.setTitle(
                faceUi.general[j].title + ': ' + sideName
            );
            let panel = faceUi.general[j].panel.realize();
            this.generalPanel['add(java.awt.Component,java.lang.Object,int)'](
                panel,
                GeneralHint,
                generalIndex + j
            );
            side.general.push(panel);
        }

        var tabIndex = tabPane.indexOfComponent(this.generalTab) + 1;
        if (faceIndex !== FACE_FRONT)
            tabIndex += this.sideInterfaces[FACE_FRONT].tabs.length;
        for (let j = 0; j < faceUi.tabs.length; j++) {
            faceUi.tabs[j].panel.editorTabScrolling = true;
            faceUi.tabs[j].panel.addToEditor(
                this.editor,
                faceUi.tabs[j].title + ': ' + sideName,
                null,
                null,
                tabIndex + j
            );
            side.tabs.push(tabPane.getComponentAt(tabIndex + j));
        }

        this.sideInterfaces[faceIndex] = side;
        this.generalPanel.revalidate();
        this.generalPanel.repaint();
    };

    // mirrors the portrait's image left to right, keeping its placement
    function mirrorPortrait(portrait) {
        var scale = portrait.getScale();
        var rotation = portrait.getRotation();
        var panX = portrait.getPanX();
        var panY = portrait.getPanY();
        portrait.setImage(
            portrait.getSource(),
            imageutils.ImageUtils.mirror(portrait.getImage(), true, false)
        );
        portrait.setScale(scale);
        portrait.setRotation(rotation);
        portrait.setPanX(panX);
        portrait.setPanY(panY);
    }

    // A side's art portraits, a mirror button for each, and the face's
    // $Artist<suffix>.
    // whether the back's art can be the front's: both sides have art of a
    // name
    FaceHandler.prototype.canShareArt = function () {
        var back = this.faces[FACE_BACK].portraits;
        return this.faces[FACE_FRONT].portraits.some(function (name) {
            return back.indexOf(name) >= 0;
        });
    };

    // $PortraitShare: the back shows the front's art, and its artist unless
    // it names its own
    FaceHandler.prototype.sharesArt = function (diy) {
        return (
            this.canShareArt() &&
            String(diy.settings.get('PortraitShare', '0')) === '1'
        );
    };

    FaceHandler.prototype.createArtPanel = function (diy, faceIndex, both) {
        var face = this.faces[faceIndex];
        var first = faceIndex === FACE_FRONT ? 0 : this.art[FACE_FRONT].length;
        var panel = new ui.Grid();
        var controls = [];
        var side = both
            ? ': ' +
              strings.string(
                  faceIndex === FACE_FRONT ? 'AHLCG-Front' : 'AHLCG-Back'
              )
            : '';
        var options = new ui.Grid();
        options.setTitle(strings.string('AHLCG-Options') + side);

        if (faceIndex === FACE_BACK && this.canShareArt()) {
            let share = new ui.checkBox(
                strings.string('AHLCG-SharePortrait'),
                false,
                null
            );
            this.bindings.add('PortraitShare', share, [FACE_FRONT, FACE_BACK]);
            controls.push(share);
            options.place(share, 'wrap, span 2');
        }
        var artistField = new ui.textField('', 30);
        this.bindings.add(
            'Artist' + face.suffix(faceIndex),
            artistField,
            faceIndex === FACE_FRONT ? [FACE_FRONT, FACE_BACK] : [FACE_BACK]
        );
        controls.push(artistField);
        options.place(
            strings.string('AHLCG-Artist'),
            'align right',
            artistField,
            'pushx, growx'
        );

        this.art[faceIndex].forEach(function (portrait, j) {
            let imagePanel = new ui.portraitPanel(
                diy,
                first + j,
                strings.string('AHLCG-Portrait') + side
            );
            panel.place(imagePanel, 'wrap, pushx, growx');
            options.place(
                new ui.button(
                    strings.string('AHLCG-Mirror'),
                    null,
                    function mirror() {
                        try {
                            mirrorPortrait(portrait);
                            imagePanel.updatePanel();
                        } catch (ex) {
                            Error.handleUncaught(ex);
                        }
                    }
                ),
                'align right'
            );
        });
        panel.place(options, 'wrap, pushx, growx');

        return { panel: panel, controls: controls };
    };

    // Both sides' art and options share one tab after the sides' text tabs.
    FaceHandler.prototype.addArtInterface = function (diy) {
        var sides = [FACE_FRONT, FACE_BACK].filter(function (faceIndex) {
            return this.art[faceIndex].length > 0;
        }, this);
        if (sides.length === 0) return;
        var panel = new ui.Grid();
        var controls = [];
        sides.forEach(function (faceIndex) {
            let art = this.createArtPanel(diy, faceIndex, sides.length > 1);
            panel.place(art.panel, GeneralHint);
            controls = controls.concat(art.controls);
        }, this);
        panel.editorTabScrolling = true;
        var index = this.collectorTabIndex();
        panel.addToEditor(
            this.editor,
            strings.string('AHLCG-Portraits'),
            null,
            null,
            index
        );
        this.artTab = {
            component: this.editor.getTabbedPane().getComponentAt(index),
            controls: controls,
        };
    };

    FaceHandler.prototype.removeArtInterface = function () {
        if (this.artTab == null) return;
        this.artTab.controls.forEach(function (control) {
            this.bindings.remove(control);
        }, this);
        this.editor.getTabbedPane().remove(this.artTab.component);
        this.artTab = null;
    };

    FaceHandler.prototype.removeFaceInterface = function (diy, faceIndex) {
        var tabPane = this.editor.getTabbedPane();
        var side = this.sideInterfaces[faceIndex];

        this.faces[faceIndex].removeInterface(diy, this.bindings, faceIndex);
        for (let j = 0; j < side.general.length; j++) {
            this.generalPanel.remove(side.general[j]);
        }
        for (let j = 0; j < side.tabs.length; j++) {
            tabPane.remove(side.tabs[j]);
        }
        this.sideInterfaces[faceIndex] = null;
    };

    // Calls change, which replaces the face on a side, updating the open editor
    // in place: the side's controls, and new sheets, since templates can differ.
    FaceHandler.prototype.changeFace = function (diy, faceIndex, change) {
        this.bindings.flush();
        this.removeCollectorInterface();
        this.removeArtInterface();
        this.removeFaceInterface(diy, faceIndex);
        change();
        this.addFaceInterface(diy, faceIndex);
        this.addArtInterface(diy);
        this.addCollectorInterface(diy);
        this.editor.setGameComponent(diy);
        diy.markChanged(faceIndex);
    };

    FaceHandler.prototype.createFacePainter = function (diy, sheet, faceIndex) {
        this.boxes[faceIndex] = this.faces[faceIndex].createPainter(
            diy,
            sheet,
            faceIndex
        );
    };

    FaceHandler.prototype.createFrontPainter = function (diy, sheet) {
        this.createFacePainter(diy, sheet, FACE_FRONT);
    };

    FaceHandler.prototype.createBackPainter = function (diy, sheet) {
        this.createFacePainter(diy, sheet, FACE_BACK);
    };

    FaceHandler.prototype.paintFace = function (g, diy, sheet) {
        var faceIndex = sheet.getSheetIndex();
        var bothShow =
            String(diy.settings.get('ShowCollectionNumberFront', '1')) ===
                '1' &&
            String(diy.settings.get('ShowCollectionNumberBack', '1')) === '1';
        var face = this.faces[faceIndex];
        var art = {};
        face.portraits.forEach(function (name, j) {
            art[name] = this.art[faceIndex][j];
        }, this);
        if (faceIndex === FACE_BACK && this.sharesArt(diy)) {
            this.faces[FACE_FRONT].portraits.forEach(function (name, j) {
                if (name in art) art[name] = this.art[FACE_FRONT][j];
            }, this);
        }
        face.paint(
            g,
            diy,
            sheet,
            this.boxes[faceIndex],
            {
                collection: this.findPortrait('Collection'),
                encounter: this.findPortrait('Encounter'),
                encounterReference: this.encounterReference(diy),
                suffix:
                    bothShow &&
                    this.showsCollectionNumber(FACE_FRONT) &&
                    this.showsCollectionNumber(FACE_BACK),
            },
            art
        );
    };

    FaceHandler.prototype.paintFront = function (g, diy, sheet) {
        this.paintFace(g, diy, sheet);
    };

    FaceHandler.prototype.paintBack = function (g, diy, sheet) {
        this.paintFace(g, diy, sheet);
    };

    FaceHandler.prototype.onClear = function (diy) {
        this.setDefaults(diy);
    };

    // A portrait saved by a legacy handler, under its own key, moved to the
    // face key; its image, pan and scale are kept.
    FaceHandler.prototype.adoptPortrait = function (kind, portrait) {
        var key = 'AHLCG-Face-' + kind;
        if (String(portrait.getBaseKey()) === key) return portrait;

        var adopted = new DefaultPortrait(key, portrait);
        adopted.facesToUpdate = [FACE_FRONT, FACE_BACK];
        adopted.backgroundFilled = false;
        return adopted;
    };

    // An art portrait saved under another key, moved to the key of the one
    // created in its place, with that one's settings.
    FaceHandler.prototype.adoptArt = function (portrait, created) {
        var key = String(created.getBaseKey());
        if (String(portrait.getBaseKey()) === key) return portrait;

        var adopted = new DefaultPortrait(key, portrait);
        adopted.facesToUpdate = created.facesToUpdate;
        adopted.backgroundFilled = created.backgroundFilled;
        return adopted;
    };

    // The portraits a save from before this version holds, in order, or null
    // if it holds those of the faces: 'Collection' or 'Encounter' for a set,
    // [ faceIndex, name ] for art and null for one that is dropped. Called
    // after the upgrade, while diy.version is the saved version.
    FaceHandler.prototype.legacyPortraits = function (diy) {
        return this.config.legacyPortraits || null;
    };

    // Reads the portraits listed by legacyPortraits into the faces' art and
    // sets; those the faces don't use are dropped.
    FaceHandler.prototype.readLegacyPortraits = function (diy, ois, list) {
        for (let i = 0; i < list.length; i++) {
            let portrait;
            try {
                portrait = ois.readObject();
            } catch (ex) {
                return;
            }
            let entry = list[i];
            if (entry == null) continue;
            if (typeof entry === 'string') {
                let k = this.portraitKinds.indexOf(entry);
                if (k < 0) continue;
                this.portraits[k] = this.adoptPortrait(entry, portrait);
                Collector.update(diy, entry, this.portraits[k]);
                continue;
            }
            let j = this.faces[entry[0]].portraits.indexOf(entry[1]);
            if (j < 0) continue;
            this.art[entry[0]][j] = this.adoptArt(
                portrait,
                this.art[entry[0]][j]
            );
        }
    };

    // Reads the faces' art, then their sets, each kept as created if the
    // save ends first.
    FaceHandler.prototype.readPortraits = function (diy, ois) {
        this.art.forEach(function (portraits) {
            for (let j = 0; j < portraits.length; j++) {
                try {
                    portraits[j] = this.adoptArt(
                        ois.readObject(),
                        portraits[j]
                    );
                } catch (ex) {
                    return;
                }
            }
        }, this);
        this.portraitKinds.forEach(function (kind, i) {
            // a save from before the faces used this set has no portrait
            try {
                this.portraits[i] = this.adoptPortrait(kind, ois.readObject());
            } catch (ex) {
                return;
            }
            Collector.update(diy, kind, this.portraits[i]);
        }, this);
    };

    FaceHandler.prototype.onRead = function (diy, ois) {
        diy.faceStyle = diyLibrary.FaceStyle.TWO_FACES;
        FaceUtils.clearBleedMargin(diy);
        this.upgrade(diy);
        // an older save lacks the settings the faces added since
        if (diy.version < this.version) {
            for (let i = 0; i < this.faces.length; i++) {
                this.faces[i].setDefaults(diy, i, true);
            }
            this.setFaceTemplates(diy);
        }

        this.updateCollector(diy);
        var legacy =
            diy.version < this.version ? this.legacyPortraits(diy) : null;
        if (legacy != null) this.readLegacyPortraits(diy, ois, legacy);
        else this.readPortraits(diy, ois);
        if (diy.version < this.version && this.config.upgradeArt)
            this.config.upgradeArt(diy, this.art);

        diy.setCornerRadius(8);
        diy.version = this.version;
    };

    FaceHandler.prototype.onWrite = function (diy, oos) {
        this.allPortraits().forEach(function (portrait) {
            oos.writeObject(portrait);
        });
    };

    return FaceHandler;
});
