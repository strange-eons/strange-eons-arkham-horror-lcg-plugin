// Default values a project chooses for the cards of a face: a face with
// projectDefaults keeps its Game Text keys, without the side's suffix, in the
// project's settings as <template>-<key>. Only values other than the face's
// own defaults are stored.
//
// Module: returns { keyOf, read, write, forNewCard, sidesOf, applyToCard }.
define(['se/java'], function (java) {
    function keyOf(face, key) {
        return face.template + '-' + key;
    }

    // the face's stored values: { key: value }
    function read(settings, face) {
        var result = {};
        Object.keys(face.textDefaults()).forEach(function (key) {
            let value = settings.get(keyOf(face, key));
            if (value != null) result[key] = String(value);
        });
        return result;
    }

    // stores the values given for the face's keys; a face default is removed
    function write(settings, face, values) {
        var defaults = face.textDefaults();
        Object.keys(defaults).forEach(function (key) {
            if (!(key in values)) return;
            let value = String(values[key]);
            if (value === defaults[key]) settings.reset(keyOf(face, key));
            else settings.set(keyOf(face, key), value);
        });
    }

    // the open project's values for a face new to a card, or null
    function forNewCard(face) {
        if (!face.projectDefaults) return null;
        var Eons = java.type('ca.cgjennings.apps.arkham.StrangeEons');
        var project = Eons.getOpenProject();
        return project == null ? null : read(project.getSettings(), face);
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

    // Sets values, keyed as by textDefaults, on each side of the card that
    // shows the face; blank part text is left out. Returns whether it did.
    function applyToCard(component, face, values) {
        var sides = sidesOf(component, face);
        var defaults = face.textDefaults();
        sides.forEach(function (faceIndex) {
            Object.keys(values).forEach(function (key) {
                if (!(key in defaults)) return;
                let value = String(values[key]);
                if (face.parts.indexOf(key) >= 0 && value.trim() === '') return;
                component.settings.set(face.textKey(key, faceIndex), value);
            });
        });
        return sides.length > 0;
    }

    return {
        keyOf: keyOf,
        read: read,
        write: write,
        forNewCard: forNewCard,
        sidesOf: sidesOf,
        applyToCard: applyToCard,
    };
});
