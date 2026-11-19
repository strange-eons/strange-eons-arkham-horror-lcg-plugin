// The preferences' default values: the encounter set and collection new cards
// start with, offered from the basic and checked sets, and portrait bleed.
//
// Settings: AHLCG-DefaultEncounterSet, AHLCG-DefaultCollection and
// AHLCG-PortraitBleed.
//
// Module: returns { create, layout, refresh, load, select, store }.
define(['prefs/SetTables', 'se/java', 'se/strings', 'se/ui'], function (
    SetTables,
    Java,
    strings,
    ui
) {
    const ListItem = Java.type('ca.cgjennings.apps.arkham.diy.ListItem');

    function basicItems(list) {
        return list.map(function (value) {
            return new ListItem(value, strings.string('AHLCG-' + value));
        });
    }

    function create(o) {
        var encounter = ui.comboBox(basicItems(o.basicEncounterList));
        var size = encounter.getPreferredSize();
        size.width = 200;
        encounter.setPreferredSize(size);
        var collection = ui.comboBox(basicItems(o.basicCollectionList));
        collection.setPreferredSize(size);
        var bleed = ui.comboBox([
            new ListItem(
                'None',
                strings.string('AHLCG-Pref-PortraitBleed-None')
            ),
            new ListItem(
                'MirrorEdges',
                strings.string('AHLCG-Pref-PortraitBleed-MirrorEdges')
            ),
        ]);
        bleed.setPreferredSize(size);
        return { encounter: encounter, collection: collection, bleed: bleed };
    }

    function layout(pc, defaults) {
        pc.heading(strings.string('AHLCG-Pref-DefaultValues'));
        [
            ['AHLCG-Pref-DefaultSet', defaults.encounter],
            ['AHLCG-Pref-DefaultCollection', defaults.collection],
            ['AHLCG-Pref-PortraitBleed', defaults.bleed],
        ].forEach(function (pair) {
            pc.label(strings.string(pair[0]));
            pc.join();
            pc.addUnmanagedControl(pair[1]);
        });
    }

    // selects the item whose value is given, or Strange Eons
    function select(box, value) {
        var index = 1;
        for (let i = 0; i < box.getItemCount(); i++) {
            if (value != null && String(box.getItemAt(i)) === String(value)) {
                index = i;
                break;
            }
        }
        box.setSelectedIndex(index);
    }

    // offers the basic sets and the checked sets of the tables, keeping the
    // selection
    function refresh(o, box, tables) {
        var selected = String(box.getSelectedItem());
        var basic = tables.kind.basicList(o).length;
        while (box.getItemCount() > basic) box.removeItemAt(basic);
        SetTables.addChecked(o, tables, box);
        select(box, selected);
    }

    function load(defaults, settings) {
        var bleed = String(settings.get('AHLCG-PortraitBleed', 'None'));
        defaults.bleed.setSelectedIndex(bleed === 'MirrorEdges' ? 1 : 0);
    }

    function store(defaults, settings) {
        [
            ['AHLCG-DefaultEncounterSet', defaults.encounter],
            ['AHLCG-DefaultCollection', defaults.collection],
            ['AHLCG-PortraitBleed', defaults.bleed],
        ].forEach(function (pair) {
            settings.set(pair[0], String(pair[1].getSelectedItem()));
        });
    }

    return {
        create: create,
        layout: layout,
        refresh: refresh,
        load: load,
        select: select,
        store: store,
    };
});
