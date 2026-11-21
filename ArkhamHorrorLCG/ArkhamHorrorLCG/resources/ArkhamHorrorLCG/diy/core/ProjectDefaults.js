// The project's layout choice for new cards: AHLCG-FillFlavor in its
// settings, which faces that fill flavor copy to FillFlavor<suffix>
// (see FillFlavor). A project opened without it gets it: on for a project
// with no cards yet, off for one that has some.
//
// Module: returns { KEY, enabled, setEnabled, initialize, forNewCard,
// sidesOf, applyToCard }.
define(['faces/FillFlavor', 'se/java'], function (FillFlavor, java) {
    const KEY = 'AHLCG-FillFlavor';

    function enabled(settings) {
        return FillFlavor.isOn(settings.get(KEY, '0'));
    }

    function setEnabled(settings, on) {
        settings.set(KEY, on ? '1' : '0');
    }

    function hasCards(folder) {
        return folder.getChildren().some(function (kid) {
            return kid.isFolder()
                ? hasCards(kid)
                : String(kid.getExtension()) === 'eon';
        });
    }

    // gives a project without the setting one; returns whether it did
    function initialize(project) {
        var settings = project.getSettings();
        if (settings.get(KEY) != null) return false;
        setEnabled(settings, !hasCards(project));
        project.writeTaskSettings();
        return true;
    }

    // the open project's values for a face new to a card, or null
    function forNewCard(face) {
        if (!face.fillsFlavor()) return null;
        var Eons = java.type('ca.cgjennings.apps.arkham.StrangeEons');
        var project = Eons.getOpenProject();
        if (project == null) return null;
        var values = {};
        values[FillFlavor.KEY] = enabled(project.getSettings()) ? '1' : '0';
        return values;
    }

    // the sides of a card of this plug-in that show the face: those whose
    // template its handler set to the face's
    function sidesOf(component, face) {
        var DIY = java.type('ca.cgjennings.apps.arkham.diy.DIY');
        if (!(component instanceof DIY)) return [];
        if (!/^(res:\/\/)?ArkhamHorrorLCG\//.test(component.getHandlerScript()))
            return [];
        var settings = component.settings;
        var template = String(settings.get(face.template + '-template', ''));
        return [component.getFrontTemplateKey(), component.getBackTemplateKey()]
            .map(function (key, faceIndex) {
                return String(settings.get(key + '-template', '')) === template
                    ? faceIndex
                    : -1;
            })
            .filter(function (faceIndex) {
                return faceIndex >= 0;
            });
    }

    // Sets FillFlavor<suffix> on each side of the card that shows the
    // face. Returns whether it did.
    function applyToCard(component, face, on) {
        var sides = sidesOf(component, face);
        sides.forEach(function (faceIndex) {
            component.settings.set(
                FillFlavor.KEY + face.suffix(faceIndex),
                on ? '1' : '0'
            );
        });
        return sides.length > 0;
    }

    return {
        KEY: KEY,
        enabled: enabled,
        setEnabled: setEnabled,
        initialize: initialize,
        forNewCard: forNewCard,
        sidesOf: sidesOf,
        applyToCard: applyToCard,
    };
});
