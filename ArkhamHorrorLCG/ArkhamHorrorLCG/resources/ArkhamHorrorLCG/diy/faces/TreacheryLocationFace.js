// A treachery that is also a location: treachery art and text with shroud
// and clues.
//
// Module: returns TreacheryLocationFace.
define([
    'faces/LocationFace',
    'faces/LocationParts',
    'faces/TreacheryFace',
    'se/strings',
], function (LocationFace, LocationParts, TreacheryFace, strings) {
    function TreacheryLocationFace() {
        TreacheryFace.call(this);
    }

    TreacheryLocationFace.prototype = Object.create(TreacheryFace.prototype);
    TreacheryLocationFace.prototype.constructor = TreacheryLocationFace;
    TreacheryLocationFace.prototype.template = 'AHLCG-TreacheryLocationFace';
    TreacheryLocationFace.prototype.subtypes = null;
    TreacheryLocationFace.prototype.hasUnique = false;

    TreacheryLocationFace.prototype.defaultValues = function (diy, faceIndex) {
        return {
            Shroud: '1',
            Clues: '1',
            PerInvestigator: '1',
            ShroudPerInvestigator: '0',
        };
    };

    TreacheryLocationFace.prototype.createPanels = function (
        diy,
        bindings,
        faceIndex
    ) {
        return [
            {
                panel: LocationFace.prototype.createStatPanel.call(
                    this,
                    bindings,
                    faceIndex
                ),
                title: strings.string('AHLCG-BasicData'),
            },
        ];
    };

    TreacheryLocationFace.prototype.paintContent = function (
        g,
        diy,
        sheet,
        boxes,
        collector
    ) {
        var suffix = this.suffix(sheet.getSheetIndex());
        this.paintLabel(g, diy, boxes.label);
        this.paintName(g, diy, sheet, boxes.name);
        this.paintBody(g, diy, boxes.body, suffix);
        LocationParts.paintShroud(this, g, diy, sheet, suffix);
        LocationParts.paintClues(this, g, diy, sheet, suffix, false, null);
        this.paintCollector(g, diy, sheet, boxes, collector, true, true);
    };

    return TreacheryLocationFace;
});
