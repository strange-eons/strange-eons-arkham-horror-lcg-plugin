// Treachery card, or a weakness treachery (see CardFace).
//
// Module: returns TreacheryFace.
define(['faces/CardFace', 'se/strings', 'se/ui'], function (
    CardFace,
    strings,
    ui
) {
    function TreacheryFace() {
        CardFace.call(this);
    }

    TreacheryFace.prototype = Object.create(CardFace.prototype);
    TreacheryFace.prototype.constructor = TreacheryFace;
    TreacheryFace.prototype.template = 'AHLCG-TreacheryFace';
    TreacheryFace.prototype.labelKey = 'AHLCG-Label-Treachery';
    TreacheryFace.prototype.fillReturnEncounterIcon = true;
    TreacheryFace.prototype.subtypes = [
        'None',
        'BasicWeakness',
        'Weakness',
        'StoryWeakness',
    ];
    TreacheryFace.prototype.weaknessOverlays = {
        BasicWeakness: 'BasicWeakness',
        StoryWeakness: 'BasicWeakness',
    };

    TreacheryFace.prototype.createPanels = function (diy, bindings, faceIndex) {
        var panel = new ui.Grid();
        panel.place(
            strings.string('AHLCG-Type'),
            'align right',
            this.createSubtypeList(bindings, faceIndex),
            'pushx, growx'
        );
        return [{ panel: panel, title: strings.string('AHLCG-BasicData') }];
    };

    TreacheryFace.prototype.paintContent = function (
        g,
        diy,
        sheet,
        boxes,
        collector
    ) {
        this.paintLabel(g, diy, boxes.label);
        this.paintName(g, diy, sheet, boxes.name);
        this.paintWeakness(g, diy, sheet, boxes);
        this.paintBody(g, diy, boxes.body, this.suffix(sheet.getSheetIndex()));

        var encounter = this.showsEncounter();
        this.paintCollector(
            g,
            diy,
            sheet,
            boxes,
            collector,
            encounter,
            encounter
        );
    };

    return TreacheryFace;
});
