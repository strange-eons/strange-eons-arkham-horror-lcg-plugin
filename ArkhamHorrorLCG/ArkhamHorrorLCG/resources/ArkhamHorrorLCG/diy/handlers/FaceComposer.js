// Composes a flexible card from the faces of other cards. A conversion to a
// flexible card composes when its trigger has the cause Cause and names, for
// each side of the new card, where its face comes from:
//   trigger.getFaceComponent( faceIndex )  the conversion's source, or a
//                                          flexible card
//   trigger.getFaceSide( faceIndex )       0 front, 1 back
// and calls trigger.composed(), if it has one, once the card is composed.
//
// The new card starts as the converted source. A side whose face comes from
// elsewhere gets that face with the settings and art it keeps (see
// Face.settingPairs) and its title; what a back showed from its front is
// written out (see Face.inheritedSettings), also on a kept back.
// Settings both faces share must agree, or the conversion is cancelled. The
// collector line stays the source's while the source's other face draws it,
// and the collection number's side suffix follows the new card's faces.
//
// Module: returns { Cause, isComposing, compose }.
define(['handlers/FlexibleFaces', 'se/java'], function (FlexibleFaces, Java) {
    const File = Java.type('java.io.File');
    const ImageIO = Java.type('javax.imageio.ImageIO');
    const Cause = 'AHLCG-ComposeFaces';
    const FlexibleScript = 'ArkhamHorrorLCG/diy/Flexible.js';
    const FaceSettings = ['FrontFace', 'BackFace'];
    const Defaults = ['playerBack', 'encounterBack'];
    const Suffixes = ['', 'Back'];
    const Kinds = ['Collection', 'Encounter'];

    function isComposing(session) {
        var trigger = session.getTrigger();
        return (
            String(trigger.getCause()) === Cause &&
            typeof trigger.getFaceComponent === 'function'
        );
    }

    // { id, face } of a flexible card's side, or null for another component
    function faceOf(component, faceIndex) {
        if (
            typeof component.getHandlerScript !== 'function' ||
            String(component.getHandlerScript()) !== FlexibleScript
        )
            return null;
        var id = String(
            component.settings.get(FaceSettings[faceIndex], Defaults[faceIndex])
        );
        var choice = findChoice(id) || findChoice(Defaults[faceIndex]);
        return { id: choice.id, face: new choice.face() };
    }

    function findChoice(id) {
        var found = FlexibleFaces.choices.filter(function (choice) {
            return choice.id === id;
        });
        return found.length > 0 ? found[0] : null;
    }

    function setTitle(diy, faceIndex, title) {
        if (faceIndex === 0) diy.setName(title);
        else diy.settings.set('TitleBack', title);
    }

    function copySetting(from, fromKey, to, toKey) {
        var value = from.settings.getOverride(fromKey);
        if (value != null) to.settings.set(toKey, value);
        else to.settings.reset(toKey);
    }

    // the portrait of a component with the base key, or null
    function findPortrait(component, key) {
        for (let i = 0; i < component.getPortraitCount(); i++) {
            let portrait = component.getPortrait(i);
            if (
                typeof portrait.getBaseKey === 'function' &&
                String(portrait.getBaseKey()) === key
            )
                return portrait;
        }
        return null;
    }

    // as ConversionSession.copyPortrait, between any two components
    function copyPortrait(from, to) {
        var source = from.getSource();
        if (source != null && new File(source).canRead()) {
            to.setSource(source);
        } else {
            let file = File.createTempFile('compose-', '.png');
            try {
                ImageIO.write(from.getImage(), 'png', file);
                to.setSource(file.getAbsolutePath());
            } finally {
                file['delete']();
            }
        }
        to.setPanX(from.getPanX());
        to.setPanY(from.getPanY());
        to.setRotation(from.getRotation());
        to.setScale(from.getScale());
    }

    // where each side's face comes from: { component, faceIndex, face, id }
    // for a side that changes, null for one kept; cancels the session and
    // returns null when a face can't be read
    function readSources(session) {
        var trigger = session.getTrigger();
        var source = session.getSource();
        var sources = [0, 1].map(function (faceIndex) {
            var component = trigger.getFaceComponent(faceIndex);
            var from = Number(trigger.getFaceSide(faceIndex));
            if (component.equals(source) && from === faceIndex) return null;
            var found = faceOf(component, from);
            if (found != null) {
                found.component = component;
                found.faceIndex = from;
            }
            return found || { missing: component };
        });
        var missing = sources.filter(function (from) {
            return from != null && from.missing != null;
        });
        if (missing.length === 0) return sources;
        session.cancel('not a flexible card: ' + missing[0].missing.getName());
        return null;
    }

    // Settings both final faces share, with differing values. Collector
    // settings don't conflict: they stay the source's.
    function conflicts(faces, owners) {
        var found = [];
        var back = faces[1].sharedSettings(owners[1]);
        faces[0].sharedSettings(owners[0]).forEach(function (key) {
            if (back.indexOf(key) < 0) return;
            var front = owners[0].settings.getOverride(key);
            var other = owners[1].settings.getOverride(key);
            if (String(front) !== String(other))
                found.push(key + ' (' + front + ' / ' + other + ')');
        });
        return found;
    }

    // The art names a component's back shows from its front, as
    // FaceHandler.sharesArt.
    function sharedArt(component, front, back) {
        if (String(component.settings.get('PortraitShare', '0')) !== '1')
            return [];
        return back.portraits.filter(function (name) {
            return front.portraits.indexOf(name) >= 0;
        });
    }

    // Copies a side's art from a component, where its own or, for a back that
    // shared it, the front's, with its edge mirroring and artist.
    function copyArt(from, diy, face, faceIndex) {
        var shared =
            from.faceIndex === 1
                ? sharedArt(from.component, from.front, from.face)
                : [];
        from.face.portraits.forEach(function (name) {
            var fromKey =
                shared.indexOf(name) >= 0
                    ? from.front.portraitKey(0, name)
                    : from.face.portraitKey(from.faceIndex, name);
            var key = face.portraitKey(faceIndex, name);
            copySetting(
                from.component,
                fromKey + '-MirrorEdges',
                diy,
                key + '-MirrorEdges'
            );
            var source = findPortrait(from.component, fromKey);
            var target = findPortrait(diy, key);
            if (source != null && target != null && !source.equals(target))
                copyPortrait(source, target);
        });
        var artist = 'Artist' + Suffixes[faceIndex];
        if (
            shared.length > 0 &&
            String(from.component.settings.get('ArtistBack', '')) === ''
        )
            copySetting(from.component, 'Artist', diy, artist);
    }

    // Composes the converted card diy, whose handler is a FaceChoiceHandler
    // and holds the source's faces.
    function compose(handler, diy, session) {
        var sources = readSources(session);
        if (sources == null) return;
        if (sources[0] == null && sources[1] == null) {
            done(session);
            return;
        }
        var faces = [0, 1].map(function (i) {
            return sources[i] ? sources[i].face : handler.faces[i];
        });
        var owners = [0, 1].map(function (i) {
            return sources[i] ? sources[i].component : diy;
        });
        var found = conflicts(faces, owners);
        if (found.length > 0) {
            session.cancel('conflicting settings: ' + found.join(', '));
            return;
        }
        sources.forEach(function (from) {
            if (from != null)
                from.front =
                    from.faceIndex === 0
                        ? from.face
                        : faceOf(from.component, 0).face;
        });

        // a kept back keeps what it showed from the front
        if (sources[1] == null) {
            let kept = {
                component: diy,
                faceIndex: 1,
                face: handler.faces[1],
                front: handler.faces[0],
            };
            let inherited = kept.face.inheritedSettings(diy, 1);
            for (let key in inherited) diy.settings.set(key, inherited[key]);
            copyArt(kept, diy, kept.face, 1);
        }
        if (sources[0] != null) {
            session.disableAutomaticCopyBasics();
            session.copyComment();
            session.copyExpansions();
        }

        var collectors = {};
        sources.forEach(function (from, faceIndex) {
            if (from == null) return;
            var title = from.face.getTitle(from.component, from.faceIndex);
            var inherited = from.face.inheritedSettings(
                from.component,
                from.faceIndex
            );
            var pairs = from.face.settingPairs(from.component);

            handler.faces[faceIndex].settingPairs(diy).forEach(function (pair) {
                diy.settings.reset(pair[faceIndex]);
            });
            if (faceIndex !== 0) diy.settings.reset('TitleBack');

            pairs.forEach(function (pair) {
                copySetting(
                    from.component,
                    pair[from.faceIndex],
                    diy,
                    pair[faceIndex]
                );
            });
            from.face.sharedSettings(from.component).forEach(function (key) {
                copySetting(from.component, key, diy, key);
            });
            setTitle(diy, faceIndex, title);
            pairs.forEach(function (pair) {
                var value = inherited[pair[from.faceIndex]];
                if (value != null) diy.settings.set(pair[faceIndex], value);
            });
            diy.settings.set(FaceSettings[faceIndex], from.id);

            // collector settings the other face doesn't draw come with the face
            var drawn = faces[1 - faceIndex].collectorSettings();
            from.face.collectorSettings().forEach(function (key) {
                if (drawn.indexOf(key) >= 0 || key in collectors) return;
                copySetting(from.component, key, diy, key);
                collectors[key] = from.component;
            });
        });
        diy.settings.set('PortraitShare', '0');

        handler.applyFaceSettings(diy);

        sources.forEach(function (from, faceIndex) {
            if (from != null)
                copyArt(from, diy, handler.faces[faceIndex], faceIndex);
        });
        Kinds.forEach(function (kind) {
            var from = collectors[kind];
            if (from == null) return;
            var source = findPortrait(from, 'AHLCG-Face-' + kind);
            var target = handler.findPortrait(kind);
            if (source != null && target != null) copyPortrait(source, target);
        });
        done(session);
    }

    // tells the trigger the card is composed
    function done(session) {
        var trigger = session.getTrigger();
        if (typeof trigger.composed === 'function') trigger.composed();
    }

    return { Cause: Cause, isComposing: isComposing, compose: compose };
});
