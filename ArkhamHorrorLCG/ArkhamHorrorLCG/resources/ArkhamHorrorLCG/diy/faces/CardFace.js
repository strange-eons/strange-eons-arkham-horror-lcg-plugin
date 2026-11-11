// Base of art cards: a portrait behind the template, a title with an
// optional unique symbol and subtitle, a type label, game text in fixed parts
// (Traits, Keywords, Rules, Flavor, Victory, keyed as legacy cards save them)
// and the collector line with the artist.
//
// A face with weaknesses lists them in subtypes, 'None' first:
// $Subtype<suffix> picks one. A weakness uses the face's
// <template>-Weakness-template, its <template>-Weakness-<name> settings
// where they differ, a subtype line, and the overlay in weaknessOverlays for
// its subtype; a basic weakness also has the basic weakness icon. Only a
// card that isn't a weakness, or a story weakness, shows the encounter set.
//
// Subclasses set labelKey, and may set hasSubtitle, hasUnique, subtypes,
// weaknessOverlays and parts, and override templateKey, bodyShape and
// paintContent.
//
// Module: returns CardFace.
define([
    'faces/CollectorInfo',
    'faces/Face',
    'faces/FaceUtils',
    'faces/PortraitArt',
    'ui/SubtypeBinding',
    'se/imageutils',
    'se/markup',
    'se/strings',
    'se/ui',
    'se/java',
], function (
    CollectorInfo,
    Face,
    FaceUtils,
    PortraitArt,
    SubtypeBinding,
    imageutils,
    markup,
    strings,
    ui,
    Java
) {
    const Color = Java.type('java.awt.Color');
    const ListItem = Java.type('ca.cgjennings.apps.arkham.diy.ListItem');
    const White = Color.WHITE;
    const Black = Color.BLACK;

    function CardFace() {
        Face.call(this);
        // the side's subtype, while it is painted
        this.subtype = 'None';
    }

    CardFace.prototype = Object.create(Face.prototype);
    CardFace.prototype.constructor = CardFace;
    CardFace.prototype.portraits = ['Portrait'];
    CardFace.prototype.usesCollection = true;
    CardFace.prototype.usesEncounter = true;
    CardFace.prototype.usesCopyright = true;
    CardFace.prototype.usesTemplateReplacement = true;
    // the game string key of the type label
    CardFace.prototype.labelKey = null;
    CardFace.prototype.hasUnique = true;
    CardFace.prototype.hasSubtitle = false;
    // the weaknesses offered, 'None' first, or null
    CardFace.prototype.subtypes = null;
    // overlay image name by weakness subtype
    CardFace.prototype.weaknessOverlays = {};
    // the subtitle's region, <name>-region
    CardFace.prototype.subtitleRegion = 'Subtitle';
    // the parts with spacing after them, if not all but the last
    CardFace.prototype.spacedParts = null;
    // the parts drawn in the body, if not all of them
    CardFace.prototype.bodyParts = null;
    CardFace.prototype.parts = [
        'Traits',
        'Keywords',
        'Rules',
        'Flavor',
        'Victory',
    ];

    // the face's own values, set with the parts and their spacing
    CardFace.prototype.defaultValues = function (diy, faceIndex) {
        return {};
    };

    CardFace.prototype.setDefaults = function (diy, faceIndex, keep) {
        var values = this.defaultValues(diy, faceIndex);
        if (this.subtypes != null) {
            let key = 'Subtype' + this.suffix(faceIndex);
            if (!keep || String(diy.settings.get(key)) === 'None')
                diy.settings.reset(key);
        }
        if (this.hasUnique && !('Unique' in values)) values.Unique = '0';
        if (this.hasSubtitle) values.Subtitle = '';
        values.Artist = '';
        this.parts.forEach(function (part) {
            if (!(part in values)) values[part] = '';
        });
        // the front's title is the component name
        if (faceIndex !== 0) values.Title = '';
        this.setValues(diy, faceIndex, keep, values);

        // keyed <part><suffix>Spacing, as legacy cards save them
        var suffix = this.suffix(faceIndex);
        var spacing = {};
        (this.spacedParts || this.parts.slice(0, -1)).forEach(function (part) {
            spacing[part + suffix + 'Spacing'] = '0';
        });
        this.setSettings(diy, keep, spacing);
    };

    CardFace.prototype.clearType = function (diy, faceIndex) {
        if (this.subtypes != null)
            diy.settings.reset('Subtype' + this.suffix(faceIndex));
    };

    // General panels after the title: [ { panel, title } ]
    CardFace.prototype.createPanels = function (diy, bindings, faceIndex) {
        return [];
    };

    // the weakness list, for a General panel
    CardFace.prototype.createSubtypeList = function (bindings, faceIndex) {
        var items = this.subtypes.map(function (id) {
            return new ListItem(id, strings.string('AHLCG-WknType-' + id));
        });
        var list = new ui.comboBox(items, null);
        bindings.add(
            'Subtype' + this.suffix(faceIndex),
            list,
            [faceIndex],
            SubtypeBinding
        );
        this.boundControls.push(list);
        return list;
    };

    CardFace.prototype.readSubtype = function (diy, faceIndex) {
        var subtype = 'None';
        if (this.subtypes != null) {
            subtype = String(
                diy.settings.get('Subtype' + this.suffix(faceIndex), 'None')
            );
            if (this.subtypes.indexOf(subtype) < 0) subtype = 'None';
        }
        this.subtype = subtype;
        return subtype;
    };

    CardFace.prototype.isWeakness = function () {
        return this.subtype !== 'None';
    };

    // a weakness's own settings, where it has them
    CardFace.prototype.key = function (settings, name) {
        if (this.isWeakness()) {
            let key = this.template + '-Weakness-' + name;
            if (settings.get(key) != null) return key;
        }
        return Face.prototype.key.call(this, settings, name);
    };

    CardFace.prototype.createInterface = function (diy, bindings, faceIndex) {
        return {
            general: [
                {
                    panel: this.createTitlePanel(diy, bindings, faceIndex),
                    title: strings.string('AHLCG-Title'),
                },
            ].concat(this.createPanels(diy, bindings, faceIndex)),
            tabs: [
                {
                    panel: FaceUtils.createTextPanel(
                        this,
                        bindings,
                        faceIndex,
                        this.parts,
                        '',
                        6
                    ),
                    title: strings.string('AHLCG-Rules'),
                },
            ],
        };
    };

    function iconButton(name) {
        var ImageUtils = imageutils.ImageUtils;
        return new ui.toggleButton(
            '',
            ImageUtils.createIcon(
                ImageUtils.get('ArkhamHorrorLCG/icons/AHLCG-' + name + '.png'),
                12,
                12
            ),
            false
        );
    }
    CardFace.iconButton = iconButton;

    // the title with a unique toggle, and the subtitle
    CardFace.prototype.createTitlePanel = function (diy, bindings, faceIndex) {
        var panel = new ui.Grid();
        var titleField = new ui.textField('', 30);
        if (faceIndex === 0) {
            diy.setNameField(titleField);
            titleField.setText(diy.getName());
        } else this.bind(bindings, faceIndex, 'Title', titleField);

        if (this.hasUnique) {
            let uniqueButton = iconButton('Unique');
            this.bind(bindings, faceIndex, 'Unique', uniqueButton);
            panel.place(
                strings.string('AHLCG-Title'),
                'align right',
                uniqueButton,
                'split, wmax 35, hmin 25, hmax 25',
                titleField,
                'wrap, pushx, growx'
            );
        } else {
            panel.place(
                strings.string('AHLCG-Title'),
                'align right',
                titleField,
                'wrap, pushx, growx'
            );
        }
        if (this.hasSubtitle) {
            let subtitleField = new ui.textField('', 30);
            this.bind(bindings, faceIndex, 'Subtitle', subtitleField);
            panel.place(
                strings.string('AHLCG-Subtitle'),
                'align right',
                subtitleField,
                'wrap, pushx, growx'
            );
        }
        return panel;
    };

    // the page shape for the body region, or null
    CardFace.prototype.bodyShape = function (region) {
        return null;
    };

    CardFace.prototype.createPainter = function (diy, sheet, faceIndex) {
        var boxes = {
            label: this.createBox(diy, sheet, 'Label'),
            name: this.createBox(diy, sheet, 'Name'),
            subtitle: this.createBox(diy, sheet, 'Subtitle'),
            body: this.createBox(diy, sheet, 'Body'),
            artist: this.createBox(diy, sheet, 'Artist'),
            collectionNumber: this.createBox(diy, sheet, 'CollectionNumber'),
            encounterNumber: this.createBox(diy, sheet, 'EncounterNumber'),
            copyright: this.createBox(diy, sheet, 'Copyright'),
        };
        this.readSubtype(diy, faceIndex);
        // a face with a subtype line has its style
        if (diy.settings.get(this.key(diy.settings, 'Subtype-style')) != null)
            boxes.subtype = this.createBox(diy, sheet, 'Subtype');
        FaceUtils.initBodyTags(diy, boxes.name);
        var shape = this.bodyShape(
            diy.settings.getRegion(this.key(diy.settings, 'Body-region'))
        );
        if (shape != null) boxes.body.pageShape = shape;
        FaceUtils.initBodyTags(diy, boxes.body);
        FaceUtils.initCopyrightTags(diy, boxes.copyright);
        return boxes;
    };

    // the template image setting for the side, or null for the face's own
    CardFace.prototype.templateKey = function (diy, faceIndex) {
        return this.isWeakness() ? this.template + '-Weakness-template' : null;
    };

    CardFace.prototype.paint = function (g, diy, sheet, boxes, collector, art) {
        var faceIndex = sheet.getSheetIndex();
        this.readSubtype(diy, faceIndex);

        // the art shows through the template
        this.clearSheet(g, sheet);
        var transform = g.getTransform();
        FaceUtils.translateToTrim(g, sheet);
        PortraitArt.paint(g, diy, sheet, art.Portrait);
        g.setTransform(transform);
        this.replaced = this.paintTemplateImage(
            g,
            sheet,
            this.templateKey(diy, faceIndex)
        );
        FaceUtils.translateToTrim(g, sheet);

        this.paintContent(g, diy, sheet, boxes, collector);
    };

    // what the face draws over its template, translated to the trim edge
    CardFace.prototype.paintContent = function (
        g,
        diy,
        sheet,
        boxes,
        collector
    ) {};

    CardFace.prototype.paintLabel = function (g, diy, box) {
        var region = diy.settings.getRegion(
            this.key(diy.settings, 'Label-region')
        );
        region.y += parseInt(FaceUtils.plugin().typeFontOffset);
        box.markupText = String(strings.gstring(this.labelKey)).toUpperCase();
        box.drawAsSingleLine(g, region);
    };

    // whether a back without a title of its own shows the component name,
    // the front's unique symbol and, without a subtitle, the front's
    CardFace.prototype.copiesFrontTitle = false;

    // whether the side shows the front's title
    CardFace.prototype.titleFromFront = function (diy, faceIndex) {
        return (
            this.copiesFrontTitle &&
            faceIndex !== 0 &&
            Face.prototype.getTitle.call(this, diy, faceIndex).length === 0
        );
    };

    CardFace.prototype.getTitle = function (diy, faceIndex) {
        return this.titleFromFront(diy, faceIndex)
            ? String(diy.name)
            : Face.prototype.getTitle.call(this, diy, faceIndex);
    };

    CardFace.prototype.isUnique = function (diy, faceIndex) {
        var side = this.titleFromFront(diy, faceIndex) ? 0 : faceIndex;
        return String(diy.settings.get('Unique' + this.suffix(side))) === '1';
    };

    CardFace.prototype.getSubtitle = function (diy, faceIndex) {
        var subtitle = String(
            diy.settings.get('Subtitle' + this.suffix(faceIndex), '')
        );
        if (subtitle.length === 0 && this.copiesFrontTitle && faceIndex !== 0)
            subtitle = String(diy.settings.get('Subtitle', ''));
        return subtitle;
    };

    // The title, after the unique symbol if unique; each line of a two line
    // title a little lower. lift raises it, in points.
    CardFace.prototype.paintName = function (g, diy, sheet, box, lift) {
        var faceIndex = sheet.getSheetIndex();
        var title = this.getTitle(diy, faceIndex);
        if (title.length === 0) return;

        if (this.isUnique(diy, faceIndex)) title = '<uni>' + title;

        var region = diy.settings.getRegion(
            this.key(diy.settings, 'Name-region')
        );
        region.y += parseInt(FaceUtils.plugin().titleFontOffset) - (lift || 0);

        title.split('\n').forEach(function (line) {
            box.markupText = line;
            box.drawAsSingleLine(g, region);
            region.y += 16;
            region.height -= 16;
        });
    };

    CardFace.prototype.paintSubtitle = function (g, diy, box, subtitle) {
        var region = diy.settings.getRegion(
            this.key(diy.settings, this.subtitleRegion + '-region')
        );
        region.y += parseInt(FaceUtils.plugin().subtitleFontOffset);
        box.markupText = subtitle;
        box.drawAsSingleLine(g, region);
    };

    // the subtype line, such as WEAKNESS, from a game string key
    CardFace.prototype.paintSubtype = function (g, diy, box, labelKey) {
        var region = diy.settings.getRegion(
            this.key(diy.settings, 'Subtype-region')
        );
        region.y += parseInt(FaceUtils.plugin().typeFontOffset);
        box.markupText = String(strings.gstring(labelKey)).toUpperCase();
        box.draw(g, region);
    };

    // the body's <regionName>-region
    CardFace.prototype.bodyRegion = function (diy, regionName) {
        return diy.settings.getRegion(
            this.key(diy.settings, regionName + '-region')
        );
    };

    // formats of parts other than the standard ones, for partsMarkup
    CardFace.prototype.partFormats = function (diy, suffix) {
        return null;
    };

    // regionName: Body unless the side's text has a region of its own
    CardFace.prototype.paintBody = function (g, diy, box, suffix, regionName) {
        var settings = diy.settings;
        var o = FaceUtils.plugin();

        var region = this.bodyRegion(diy, regionName || 'Body');
        region.y += parseInt(o.bodyFontOffset);

        box.setReplacementForTag('fullnameb', settings.get('TitleBack'));
        box.setLineTightness(
            Number(settings.get(this.key(settings, 'Body-tightness'))) *
                o.bodyFontTightness
        );
        box.setTextFitting(markup.FIT_SCALE_TEXT);
        box.markupText = FaceUtils.partsMarkup(
            settings,
            this.bodyParts || this.parts,
            suffix,
            this.partFormats(diy, suffix)
        );
        markup.updateNameTags(box, diy);
        box.draw(g, region);
    };

    // A weakness's overlay, icon and subtype line; the overlay and icon are
    // part of a replacement template.
    CardFace.prototype.paintWeakness = function (g, diy, sheet, boxes) {
        if (!this.isWeakness()) return;
        var overlay = this.weaknessOverlays[this.subtype];
        if (!this.replaced && overlay != null)
            this.paintImage(
                g,
                diy,
                sheet,
                'overlays/AHLCG-' + overlay + '.png',
                overlay
            );
        if (!this.replaced && this.subtype === 'BasicWeakness')
            this.paintImage(
                g,
                diy,
                sheet,
                'icons/AHLCG-BasicWeakness.png',
                'BasicWeaknessIcon'
            );
        this.paintSubtype(
            g,
            diy,
            boxes.subtype,
            this.subtype === 'BasicWeakness'
                ? 'AHLCG-Label-BasicWeakness'
                : 'AHLCG-Label-Weakness'
        );
    };

    CardFace.prototype.showsEncounterTab = function (diy, faceIndex) {
        if (!this.usesEncounter) return false;
        if (this.subtypes == null) return true;
        var subtype = String(
            diy.settings.get('Subtype' + this.suffix(faceIndex), 'None')
        );
        return subtype === 'None' || subtype === 'StoryWeakness';
    };

    // whether the side shows its encounter icon and number
    CardFace.prototype.showsEncounter = function () {
        return this.subtype === 'None' || this.subtype === 'StoryWeakness';
    };

    // a plug-in image, such as overlays/AHLCG-BasicWeakness.png, in the
    // face's <region>-region, or in area
    CardFace.prototype.paintImage = function (
        g,
        diy,
        sheet,
        image,
        region,
        area
    ) {
        sheet.paintImage(
            g,
            imageutils.ImageUtils.get('ArkhamHorrorLCG/' + image),
            area ||
                diy.settings.getRegion(
                    this.key(diy.settings, region + '-region')
                )
        );
    };

    CardFace.prototype.paintCollector = function (
        g,
        diy,
        sheet,
        boxes,
        collector,
        encounterIcon,
        encounterNumber
    ) {
        CollectorInfo.paint(
            g,
            diy,
            sheet,
            this,
            boxes,
            collector,
            encounterIcon,
            encounterNumber
        );
        CollectorInfo.paintArtist(g, diy, sheet, this, boxes.artist);
    };

    // white text with a black outline, as for stats
    CardFace.outlined = function (sheet, g, text, region, font, size) {
        sheet.drawOutlinedTitle(
            g,
            text,
            region,
            font,
            size,
            0.8,
            White,
            Black,
            0,
            true
        );
    };

    return CardFace;
});
