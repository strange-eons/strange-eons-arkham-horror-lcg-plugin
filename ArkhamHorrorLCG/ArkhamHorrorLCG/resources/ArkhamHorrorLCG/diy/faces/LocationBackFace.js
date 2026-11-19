// Unrevealed location: art, title and subtitle, the location's icon and its
// connections, which can copy the revealed side's, game text in the location
// outline, the collection and encounter icons, artist and copyright. A side
// without a title of its own shows the component name.
//
// Module: returns LocationBackFace.
define([
    'faces/CardFace',
    'faces/CollectorInfo',
    'faces/Face',
    'faces/FaceUtils',
    'faces/LocationFace',
    'faces/LocationParts',
    'se/strings',
], function (
    CardFace,
    CollectorInfo,
    Face,
    FaceUtils,
    LocationFace,
    LocationParts,
    strings
) {
    function LocationBackFace() {
        LocationFace.call(this);
    }

    LocationBackFace.prototype = Object.create(LocationFace.prototype);
    LocationBackFace.prototype.constructor = LocationBackFace;
    LocationBackFace.prototype.template = 'AHLCG-LocationBackFace';
    LocationBackFace.prototype.parts = [
        'Traits',
        'Keywords',
        'Rules',
        'Flavor',
    ];
    LocationBackFace.prototype.bodyParts = null;
    LocationBackFace.prototype.showsCollectionNumber = false;
    LocationBackFace.prototype.connectionChoices = 'comboConnectionsBack';
    LocationBackFace.prototype.noConnection = 'Copy front';
    LocationBackFace.prototype.iconCircle = 'AHLCG-LocationCircleBack.png';

    LocationBackFace.prototype.defaultValues = function (diy, faceIndex) {
        var values = {
            LocationIcon: 'Copy front',
            ShowEncounterIcon: '1',
        };
        for (let i = 1; i <= 6; i++)
            values['Connection' + i + 'Icon'] = 'Copy front';
        return values;
    };

    LocationBackFace.prototype.createPanels = function (
        diy,
        bindings,
        faceIndex
    ) {
        return [
            {
                panel: this.createConnectionPanel(bindings, faceIndex),
                title: strings.string('AHLCG-Connections'),
            },
        ];
    };

    LocationBackFace.prototype.bodyShape = function (region) {
        return FaceUtils.polygonShape(
            region,
            [0.111, 0.0, 0.0, 1.0, 1.0, 0.889],
            [0.0, 0.204, 1.0, 1.0, 0.204, 0.0]
        );
    };

    // a location icon that copies a front with nothing to copy still shows
    // its circle
    LocationBackFace.prototype.copiedValue = function (key, front) {
        if (key.startsWith('LocationIcon') && front === 'Copy front')
            return 'Empty';
        return Face.prototype.copiedValue.call(this, key, front);
    };

    LocationBackFace.prototype.getTitle = function (diy, faceIndex) {
        var title = Face.prototype.getTitle.call(this, diy, faceIndex);
        return title.length > 0 ? title : String(diy.name);
    };

    // no victory box
    LocationBackFace.prototype.createPainter = function (
        diy,
        sheet,
        faceIndex
    ) {
        return CardFace.prototype.createPainter.call(
            this,
            diy,
            sheet,
            faceIndex
        );
    };

    LocationBackFace.prototype.paintContent = function (
        g,
        diy,
        sheet,
        boxes,
        collector
    ) {
        var settings = diy.settings;
        var suffix = this.suffix(sheet.getSheetIndex());
        var subtitle = String(settings.get('Subtitle' + suffix, ''));

        if (String(settings.get('ShowEncounterIcon' + suffix, '1')) === '1')
            CollectorInfo.paintEncounterIcon(g, diy, sheet, this, collector);
        this.paintLabel(g, diy, boxes.label);
        this.paintName(g, diy, sheet, boxes.name);
        if (subtitle.length > 0)
            this.paintSubtitle(g, diy, boxes.subtitle, subtitle);
        CollectorInfo.paintCollectionIcon(g, diy, sheet, this, collector);

        var icon = String(settings.get('LocationIcon' + suffix, 'None'));
        var front = String(settings.get('LocationIcon', 'None'));
        if (icon !== 'None' && !(front === 'None' && icon === 'Copy front'))
            LocationParts.paintIcon(
                this,
                g,
                diy,
                sheet,
                'LocationIcon',
                suffix,
                true
            );
        this.paintBody(g, diy, boxes.body, suffix);
        this.paintConnections(g, diy, sheet, suffix);

        CollectorInfo.paintArtist(g, diy, sheet, this, boxes.artist);
        if (String(settings.get('Copyright', '')).length > 0)
            CollectorInfo.paintCopyright(g, diy, sheet, this, boxes.copyright);
    };

    return LocationBackFace;
});
