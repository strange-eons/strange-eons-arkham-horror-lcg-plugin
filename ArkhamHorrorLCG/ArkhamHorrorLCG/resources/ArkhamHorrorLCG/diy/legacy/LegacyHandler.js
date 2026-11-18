// Base of the handlers for cards that are not built from faces: covers,
// guides, dividers, Concealed, MiniInvestigator and Ultimatum. A handler has
// a card type and binding suffix per face, and its portraits as
// <name>-<Front|Back|Both>; it calls attach( diy ) first in create and onRead.
// The methods here paint, lay out and read the card through the legacy
// modules, for the handler's own card and portraits.
//
// Module: returns LegacyHandler, with FACE_FRONT, FACE_BACK and CARD_VERSION.
define([
    'faces/FaceUtils',
    'guide/GuideBody',
    'guide/GuidePage',
    'guide/GuidePanels',
    'handlers/CardVersion',
    'legacy/Card',
    'legacy/CollectorLine',
    'legacy/ImageFilters',
    'legacy/Panels',
    'legacy/Portraits',
    'legacy/Sets',
    'legacy/Templates',
    'legacy/Text',
    'se/markup',
], function (
    FaceUtils,
    GuideBody,
    GuidePage,
    GuidePanels,
    CardVersion,
    Card,
    CollectorLine,
    ImageFilters,
    Panels,
    Portraits,
    Sets,
    Templates,
    Text,
    markup
) {
    function LegacyHandler(types, suffixes, portraitTypes) {
        this.types = types;
        this.suffixes = suffixes;
        this.portraitTypes = portraitTypes;
        this.portraits = [];
        this.boxes = {};
        this.card = null;
    }

    LegacyHandler.FACE_FRONT = 0;
    LegacyHandler.FACE_BACK = 1;
    LegacyHandler.CARD_VERSION = CardVersion;

    // the card, from the component's settings; once per handler
    LegacyHandler.prototype.attach = function (diy) {
        if (this.card == null)
            this.card = new Card(
                diy.settings,
                this.types,
                this.suffixes,
                this.portraitTypes,
                this.portraits
            );
        return this.card;
    };

    // a setting as a string, or null
    LegacyHandler.prototype.get = function (key) {
        return this.card.get(key);
    };

    LegacyHandler.prototype.key = function (faceIndex, key, appendix) {
        return this.card.key(faceIndex, key, appendix);
    };

    // a markup box styled and aligned by the face's <name>-style and
    // <name>-alignment, or by those of alignName when given
    LegacyHandler.prototype.box = function (diy, sheet, name, alignName) {
        var box = markup.markupBox(sheet);
        box.defaultStyle = diy.settings.getTextStyle(
            this.key(LegacyHandler.FACE_FRONT, name + '-style'),
            null
        );
        box.alignment = diy.settings.getTextAlignment(
            this.key(
                LegacyHandler.FACE_FRONT,
                (alignName || name) + '-alignment'
            )
        );
        return box;
    };

    // portraits

    LegacyHandler.prototype.getPortraitCount = function () {
        return this.portraits.length;
    };

    LegacyHandler.prototype.getPortrait = function (index) {
        if (index < 0 || index >= this.portraits.length)
            throw new Error('Invalid portrait index: ' + index);
        return this.portraits[index];
    };

    LegacyHandler.prototype.portraitIndex = function (name) {
        return this.card.portraitIndex(name);
    };

    LegacyHandler.prototype.createPortraits = function (diy) {
        Portraits.create(this.card, diy);
    };

    LegacyHandler.prototype.readPortraits = function (diy, ois) {
        Portraits.read(this.card, diy, ois, true);
    };

    LegacyHandler.prototype.onWrite = function (diy, oos) {
        Portraits.write(this.card, oos);
    };

    LegacyHandler.prototype.paintPortrait = function (g, diy, sheet, name) {
        Portraits.paint(this.card, g, diy, sheet, name);
    };

    LegacyHandler.prototype.greyscale = function (source) {
        return ImageFilters.greyscale(source);
    };

    // sets

    LegacyHandler.prototype.setDefaultEncounter = function (diy) {
        Sets.setDefaultEncounter(this.card, diy);
    };

    LegacyHandler.prototype.setDefaultCollection = function (diy) {
        Sets.setDefaultCollection(this.card, diy);
    };

    LegacyHandler.prototype.updateCollection = function (diy) {
        Sets.updateCollection(this.card, diy);
    };

    LegacyHandler.prototype.updateEncounter = function (diy) {
        Sets.updateEncounter(this.card, diy);
    };

    // painting

    LegacyHandler.prototype.clearImage = function (g, sheet) {
        Templates.clear(g, sheet);
    };

    LegacyHandler.prototype.drawTemplate = function (g, sheet) {
        Templates.paintFront(this.card, g, sheet);
    };

    // backType is the selected back of cards offering player and encounter
    // backs
    LegacyHandler.prototype.drawBackTemplate = function (g, sheet, backType) {
        Templates.paintBack(this.card, g, sheet, backType);
    };

    LegacyHandler.prototype.drawFullBleed = function (g, sheet, name) {
        Templates.paintFullBleed(
            this.card,
            g,
            sheet,
            Templates.templateKey(name)
        );
    };

    LegacyHandler.prototype.initBodyTags = function (diy, box) {
        FaceUtils.initBodyTags(diy, box);
    };

    LegacyHandler.prototype.initCopyrightTags = function (diy, box) {
        FaceUtils.initCopyrightTags(diy, box);
    };

    LegacyHandler.prototype.drawName = function (g, diy, sheet, box) {
        Text.name(this.card, g, diy, sheet, box);
    };

    LegacyHandler.prototype.draw2LineName = function (g, diy, sheet, box) {
        Text.twoLineName(this.card, g, diy, sheet, box);
    };

    LegacyHandler.prototype.drawLine = function (
        g,
        diy,
        sheet,
        box,
        name,
        text
    ) {
        Text.singleLine(this.card, g, diy, sheet, box, name, text);
    };

    LegacyHandler.prototype.drawBody = function (g, diy, sheet, box, parts) {
        Text.body(this.card, g, diy, sheet, box, parts);
    };

    LegacyHandler.prototype.drawArtist = function (
        g,
        diy,
        sheet,
        box,
        forceFrontValue
    ) {
        CollectorLine.paintArtist(
            this.card,
            g,
            diy,
            sheet,
            box,
            forceFrontValue
        );
    };

    LegacyHandler.prototype.drawCollectorInfo = function (
        g,
        diy,
        sheet,
        collectionNumberBox,
        collectionIcon,
        encounterNumberBox,
        encounterIcon,
        copyrightBox,
        artistBox
    ) {
        CollectorLine.paint(
            this.card,
            g,
            diy,
            sheet,
            collectionNumberBox,
            collectionIcon,
            encounterNumberBox,
            encounterIcon,
            copyrightBox,
            artistBox
        );
    };

    LegacyHandler.prototype.drawEncounterIcon = function (g, diy, sheet) {
        CollectorLine.paintEncounterIcon(this.card, g, diy, sheet);
    };

    LegacyHandler.prototype.drawWatermark = function (g, diy, sheet) {
        CollectorLine.paintWatermark(this.card, g, diy, sheet);
    };

    // guides

    LegacyHandler.prototype.initGuideTags = function (diy, box) {
        GuidePage.initTags(diy, box);
    };

    LegacyHandler.prototype.setupGuidePortrait = function (
        diy,
        index,
        position,
        settingUp
    ) {
        GuidePage.setupPortrait(this.card, diy, index, position, settingUp);
    };

    LegacyHandler.prototype.guideBodyRegions = function (diy, regions) {
        return GuidePage.bodyRegions(this.card, regions);
    };

    LegacyHandler.prototype.drawGuideTemplate = function (g, diy, sheet, box) {
        GuidePage.paintTemplate(this.card, g, diy, sheet, box);
    };

    LegacyHandler.prototype.drawGuidePortraits = function (g, diy, sheet) {
        GuidePage.paintPortraits(this.card, g, diy, sheet);
    };

    LegacyHandler.prototype.drawPageNumber = function (g, diy, sheet, box) {
        GuidePage.paintPageNumber(this.card, g, diy, sheet, box);
    };

    LegacyHandler.prototype.drawGuideBody = function (
        g,
        diy,
        sheet,
        bodyBox,
        headerBox,
        region,
        text,
        spacing
    ) {
        GuideBody.paint(
            this.card,
            g,
            diy,
            sheet,
            bodyBox,
            headerBox,
            region,
            text,
            spacing
        );
    };

    // editor panels

    LegacyHandler.prototype.layoutTitle = function (
        diy,
        bindings,
        subtitle,
        faces,
        faceIndex
    ) {
        return Panels.title(
            this.card,
            diy,
            bindings,
            subtitle,
            faces,
            faceIndex
        );
    };

    LegacyHandler.prototype.layoutTitle2 = function (
        diy,
        bindings,
        faces,
        faceIndex
    ) {
        return Panels.title2(this.card, diy, bindings, faces, faceIndex);
    };

    LegacyHandler.prototype.layoutTitleUnique = function (
        diy,
        bindings,
        subtitle,
        faces,
        faceIndex
    ) {
        return Panels.titleUnique(
            this.card,
            diy,
            bindings,
            subtitle,
            faces,
            faceIndex
        );
    };

    LegacyHandler.prototype.layoutTitleGuide = function (
        diy,
        bindings,
        faces,
        faceIndex,
        portraitPanels
    ) {
        return GuidePanels.title(
            this.card,
            diy,
            bindings,
            faces,
            faceIndex,
            portraitPanels
        );
    };

    LegacyHandler.prototype.layoutGuideStats = function (bindings, faceIndex) {
        return GuidePanels.stats(this.card, bindings, faceIndex);
    };

    LegacyHandler.prototype.layoutConcealedStats = function (
        bindings,
        faceIndex
    ) {
        return Panels.concealedStats(this.card, bindings, faceIndex);
    };

    LegacyHandler.prototype.layoutCopyright = function (
        bindings,
        selectFaces,
        faces
    ) {
        return Panels.copyright(bindings, selectFaces, faces);
    };

    LegacyHandler.prototype.layoutText = function (
        bindings,
        parts,
        suffix,
        faceIndex
    ) {
        return Panels.text(this.card, bindings, parts, suffix, faceIndex);
    };

    LegacyHandler.prototype.layoutTint = function (bindings) {
        return Panels.tint(bindings);
    };

    // [ tab, panels... ]
    LegacyHandler.prototype.layoutPortraits = function (
        diy,
        bindings,
        frontPortrait,
        backPortrait,
        mirror,
        share,
        backArtist
    ) {
        return Panels.portraits(
            this.card,
            diy,
            bindings,
            frontPortrait,
            backPortrait,
            mirror,
            share,
            backArtist
        );
    };

    // [ tab, panels... ]
    LegacyHandler.prototype.layoutGuidePortraits = function (
        diy,
        bindings,
        leftPortrait,
        rightPortrait,
        mirror
    ) {
        return GuidePanels.portraits(
            this.card,
            diy,
            bindings,
            leftPortrait,
            rightPortrait,
            mirror
        );
    };

    LegacyHandler.prototype.layoutCollection = function (
        bindings,
        portraitPanel,
        useSpinner,
        selectFaces,
        faces,
        faceIndex
    ) {
        return Panels.collection(
            this.card,
            bindings,
            portraitPanel,
            useSpinner,
            selectFaces,
            faces,
            faceIndex
        );
    };

    LegacyHandler.prototype.layoutEncounter = function (
        bindings,
        portraitPanel,
        selectFaces,
        iconFaces,
        numberFaces,
        faceIndex
    ) {
        return Panels.encounter(
            this.card,
            bindings,
            portraitPanel,
            selectFaces,
            iconFaces,
            numberFaces,
            faceIndex
        );
    };

    LegacyHandler.prototype.layoutSimpleEncounter = function (
        bindings,
        portraitPanel,
        iconFaces,
        faceIndex
    ) {
        return Panels.simpleEncounter(
            this.card,
            bindings,
            portraitPanel,
            iconFaces,
            faceIndex
        );
    };

    return LegacyHandler;
});
