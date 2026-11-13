// Base face for FaceHandler (handlers/FaceHandler.js). A face draws one side of
// a card and owns the settings, editor panels and markup boxes for that side.
// Settings keys take the face's binding suffix ('' or 'Back').
//
// Module: returns Face.
define([
    'faces/FaceUtils',
    'se/common',
    'se/markup',
    'se/strings',
    'se/ui',
    'se/java',
], function (FaceUtils, common, markup, strings, ui, Java) {
    const AlphaComposite = Java.type('java.awt.AlphaComposite');
    const Suffixes = ['', 'Back'];

    function Face() {
        // what the face's interface added to the bindings
        this.boundControls = [];
        this.populateListeners = [];
    }

    // settings key prefix of the face's template: <template>-template is the
    // image; the card size also follows its bleed margin and resolution
    Face.prototype.template = null;
    // template bleed margin in points
    Face.prototype.bleedMargin = 8.64;
    // template resolution in pixels per inch, or null for the default
    Face.prototype.dpi = null;

    // whether the face draws the card's collection, encounter set and
    // copyright; the editor offers each only when a face draws it
    Face.prototype.usesCollection = false;
    Face.prototype.usesEncounter = false;
    Face.prototype.usesCopyright = false;
    // whether a face that draws the collection shows its number; the number
    // takes a side suffix when both faces show it
    Face.prototype.showsCollectionNumber = true;
    // collection icons are dark on art that needs them light
    Face.prototype.invertCollectionIcon = true;
    // the encounter total without space around the slash
    Face.prototype.compactEncounterTotal = false;
    // a return-to set's icon is the set it returns to, cut out of a disc
    Face.prototype.fillReturnEncounterIcon = false;
    // whether the editor offers an image to replace the template
    Face.prototype.usesTemplateReplacement = false;
    // names of the art portraits the face draws (see portraitKey); a face
    // with art also sets $Artist<suffix>
    Face.prototype.portraits = [];

    Face.prototype.suffix = function (faceIndex) {
        return Suffixes[faceIndex];
    };

    // whether the named art is painted by PortraitArt.paint, which can
    // mirror its edges into the bleed (see faces/PortraitArt.js)
    Face.prototype.mirrorsArtEdges = function (name) {
        return true;
    };

    // <template>-<name> on the front, <template>-Back<name> on the back
    Face.prototype.portraitKey = function (faceIndex, name) {
        return this.template + '-' + this.suffix(faceIndex) + name;
    };

    // with keep, only sets keys the component lacks
    Face.prototype.setDefaults = function (diy, faceIndex, keep) {};

    // removes settings that describe the face's type, when another face
    // replaces it
    Face.prototype.clearType = function (diy, faceIndex) {};

    // returns { general: [ { panel, title } ], tabs: [ { panel, title } ] }
    Face.prototype.createInterface = function (diy, bindings, faceIndex) {
        return { general: [], tabs: [] };
    };

    // binds control to the setting name + the face's suffix
    Face.prototype.bind = function (bindings, faceIndex, name, control) {
        this.bindKey(
            bindings,
            faceIndex,
            name + this.suffix(faceIndex),
            control
        );
    };

    // binds control to the setting key as given
    Face.prototype.bindKey = function (bindings, faceIndex, key, control) {
        bindings.add(key, control, [faceIndex]);
        this.boundControls.push(control);
    };

    Face.prototype.unbind = function (bindings, control) {
        bindings.remove(control);
        var index = this.boundControls.indexOf(control);
        if (index >= 0) this.boundControls.splice(index, 1);
    };

    Face.prototype.addPopulateListener = function (bindings, listener) {
        bindings.addPopulateListener(listener);
        this.populateListeners.push(listener);
    };

    // Detaches the face's interface from the bindings and the component, when
    // another face replaces it. Bindings must be flushed first.
    Face.prototype.removeInterface = function (diy, bindings, faceIndex) {
        this.boundControls.forEach(function (control) {
            bindings.remove(control);
        });
        this.boundControls = [];
        this.populateListeners.forEach(function (listener) {
            bindings.removePopulateListener(listener);
        });
        this.populateListeners = [];

        var nameField = diy.getNameField();
        if (faceIndex === 0 && nameField != null) {
            diy.setName(nameField.getText());
            diy.setNameField(null);
        }
    };

    // returns the face's markup boxes
    Face.prototype.createPainter = function (diy, sheet, faceIndex) {
        return {};
    };

    // paints the whole sheet, bleed margin included. collector: see
    // faces/CollectorInfo.js; art: the face's portraits by name
    Face.prototype.paint = function (g, diy, sheet, boxes, collector, art) {};

    // whether the editor shows the encounter set for the side as its settings
    // stand; a face that draws the set only for some templates or classes
    // hides it for the others
    Face.prototype.showsEncounterTab = function (diy, faceIndex) {
        return this.usesEncounter;
    };

    // the collector line's <name>-region, where a reversed face moves it;
    // fractional keeps a Region2D's fractions instead of rounding them
    Face.prototype.collectorRegion = function (diy, name, fractional) {
        var key = this.key(diy.settings, name + '-region');
        return fractional
            ? diy.settings.getRegion2D(key)
            : diy.settings.getRegion(key);
    };

    // <template>-<name> if set, else the shared AHLCG-Face-<name>
    Face.prototype.key = function (settings, name) {
        var key = this.template + '-' + name;
        return settings.get(key) != null ? key : 'AHLCG-Face-' + name;
    };

    // sets each key + suffix
    Face.prototype.setValues = function (diy, faceIndex, keep, values) {
        var suffixed = {};
        for (let key in values) {
            suffixed[key + this.suffix(faceIndex)] = values[key];
        }
        this.setSettings(diy, keep, suffixed);
    };

    // sets each key as is
    Face.prototype.setSettings = function (diy, keep, values) {
        for (let key in values) {
            if (keep && diy.settings.getOverride(key) != null) continue;
            diy.settings.set(key, values[key]);
        }
    };

    // markup box styled by the face's <name>-style and <name>-alignment
    Face.prototype.createBox = function (diy, sheet, name) {
        var box = markup.markupBox(sheet);
        box.defaultStyle = diy.settings.getTextStyle(
            this.key(diy.settings, name + '-style'),
            null
        );
        box.alignment = diy.settings.getTextAlignment(
            this.key(diy.settings, name + '-alignment')
        );
        return box;
    };

    // the front's title is the component name; the back's is $TitleBack
    Face.prototype.getTitle = function (diy, faceIndex) {
        if (faceIndex === 0) return String(diy.name);
        return String(diy.settings.get('Title' + this.suffix(faceIndex), ''));
    };

    // panel with a two line title field
    Face.prototype.createTitlePanel = function (diy, bindings, faceIndex) {
        var panel = new ui.Grid();
        var titleArea = new ui.textArea('', 2, 30);
        if (faceIndex === 0) {
            diy.setNameField(titleArea);
            titleArea.setText(diy.getName());
        } else this.bind(bindings, faceIndex, 'Title', titleArea);
        panel.place(
            strings.string('AHLCG-Title'),
            'align right',
            titleArea,
            'wrap, pushx, growx, ' + FaceUtils.textAreaWidth(titleArea)
        );
        return panel;
    };

    // One line centered in <Name-region>, or two lines at its top and bottom.
    Face.prototype.paintTitle = function (g, diy, box, title) {
        box.markupText = '';
        if (title.length === 0) return;

        var region = diy.settings.getRegion(
            this.key(diy.settings, 'Name-region')
        );
        region.y += parseInt(FaceUtils.plugin().titleFontOffset);

        var lines = title.split('\n');
        if (lines.length > 1) {
            box.markupText = lines[0];
            box.alignment = markup.LAYOUT_TOP | markup.LAYOUT_CENTER;
            box.drawAsSingleLine(g, region);

            box.markupText = lines[1];
            box.alignment = markup.LAYOUT_BOTTOM | markup.LAYOUT_CENTER;
            box.drawAsSingleLine(g, region);
        } else {
            region.y += 1;
            box.markupText = lines[0];
            box.alignment = markup.LAYOUT_MIDDLE | markup.LAYOUT_CENTER;
            box.drawAsSingleLine(g, region);
        }
    };

    // Clears the sheet, since a sheet reuses its image and templates can be
    // partly transparent; ink saver keeps the white background it provides.
    Face.prototype.clearSheet = function (g, sheet) {
        if (sheet.isPrototypeRenderingModeEnabled()) return;

        var composite = g.getComposite();
        g.setComposite(AlphaComposite.Clear);
        g.fillRect(0, 0, sheet.getTemplateWidth(), sheet.getTemplateHeight());
        g.setComposite(composite);
    };

    // Clears the sheet and paints the template over it; see
    // paintTemplateImage.
    Face.prototype.paintTemplate = function (g, sheet) {
        this.clearSheet(g, sheet);
        return this.paintTemplateImage(g, sheet);
    };

    // Paints the template image set by key (<template>-template by default)
    // over the whole sheet. When rendering for export or printing, the image
    // set by <key>-hires is used instead, if available; it is provided by a
    // separate plug-in. Paints the replacement image instead if there is one
    // and it can be read; returns whether it did.
    Face.prototype.paintTemplateImage = function (g, sheet, key) {
        if (this.paintReplacement(g, sheet)) return true;
        sheet.paintImage(g, key || this.template + '-template', 0, 0);
        return false;
    };

    // The replacement is a file path or a resource identifier, as for a
    // portrait. It covers the trim area unless it includes the bleed.
    Face.prototype.paintReplacement = function (g, sheet) {
        if (!this.usesTemplateReplacement) return false;

        var settings = sheet.getGameComponent().getSettings();
        var suffix = this.suffix(sheet.getSheetIndex());
        var file = String(settings.get('TemplateReplacement' + suffix, ''));
        if (file.length === 0) return false;

        if (!common.StrangeImage.exists(file)) return false;
        var image = common.StrangeImage.getAsBufferedImage(file);

        var width = sheet.getTemplateWidth();
        var height = sheet.getTemplateHeight();
        var bleed = FaceUtils.bleedPixels(sheet);
        var region = new common.Region(
            bleed,
            bleed,
            width - 2 * bleed,
            height - 2 * bleed
        );
        if (String(settings.get('TemplateReplacementBleed', '0')) === '1')
            region = new common.Region(0, 0, width, height);
        sheet.paintImage(g, image, region);
        return true;
    };

    return Face;
});
