// Investigator back: art, class art, the front's title (see CardFace), and
// eight named sections and a story in the class's outline. The subtitle is
// the card's $Subtitle, as legacy cards save it; the class is $CardClassBack,
// or the card's $CardClass when that says 'Copy front'. A Story class back
// shows the encounter set.
//
// Settings: section n is Text<n>Name<suffix> and Text<n><suffix>, with
// <text key>Spacing for the first seven; the story is InvStory<suffix>.
//
// Module: returns InvestigatorBackFace.
define([
    'faces/CardFace',
    'faces/CollectorInfo',
    'faces/FaceUtils',
    'faces/InvestigatorFace',
    'faces/PlayerCard',
    'se/java',
    'se/strings',
    'se/ui',
], function (
    CardFace,
    CollectorInfo,
    FaceUtils,
    InvestigatorFace,
    PlayerCard,
    Java,
    strings,
    ui
) {
    const ListItem = Java.type('ca.cgjennings.apps.arkham.diy.ListItem');
    const CopyFront = 'Copy front';
    const Sections = 8;
    const Standard = [
        'Deck Size',
        'Secondary Class Choice',
        'Deckbuilding Options',
        'Deckbuilding Requirements</hdr> (do not count toward deck size)<hdr>',
        'Deckbuilding Restrictions',
        'Additional Requirements',
        'Additional Restrictions',
        '',
    ];
    const Prologue = ['Setup', 'Starting Play Area', 'Opening Hand'];
    // outlines by class art, as fractions of the body region
    const Outlines = {
        G: [
            [0.355, 0.337, 0.271, 0.267, 0.01, 0.01, 1.0, 1.0],
            [0.0, 0.566, 0.566, 0.6, 0.6, 1.0, 1.0, 0.0],
        ],
        K: [
            [0.355, 0.322, 0.296, 0.275, 0.01, 0.01, 1.0, 1.0],
            [0.0, 0.585, 0.578, 0.63, 0.622, 1.0, 1.0, 0.0],
        ],
        R: [
            [0.355, 0.326, 0.272, 0.264, 0.0, 0.0, 1.0, 1.0],
            [0.0, 0.511, 0.511, 0.583, 0.583, 1.0, 1.0, 0.0],
        ],
        M: [
            [0.355, 0.315, 0.276, 0.264, 0.01, 0.01, 1.0, 1.0],
            [0.0, 0.544, 0.544, 0.611, 0.611, 1.0, 1.0, 0.0],
        ],
        N: [
            [0.4, 0.357, 0.01, 0.01, 1.0, 1.0],
            [0.0, 0.468, 0.468, 1.0, 1.0, 0.0],
        ],
    };
    Outlines.V = Outlines.M;

    function sectionParts() {
        var parts = [];
        for (let n = 1; n <= Sections; n++) parts.push('Text' + n);
        return parts;
    }

    function InvestigatorBackFace() {
        InvestigatorFace.call(this);
    }

    InvestigatorBackFace.prototype = Object.create(InvestigatorFace.prototype);
    InvestigatorBackFace.prototype.constructor = InvestigatorBackFace;
    InvestigatorBackFace.prototype.template = 'AHLCG-InvestigatorBackFace';
    InvestigatorBackFace.prototype.portraits = ['Portrait'];
    InvestigatorBackFace.prototype.usesCollection = false;
    InvestigatorBackFace.prototype.usesCopyright = false;
    InvestigatorBackFace.prototype.copiesFrontTitle = true;
    InvestigatorBackFace.prototype.hasSkills = false;
    InvestigatorBackFace.prototype.parts = sectionParts().concat(['InvStory']);
    InvestigatorBackFace.prototype.spacedParts = sectionParts().slice(0, -1);

    InvestigatorBackFace.prototype.cardClass = function (diy, faceIndex) {
        var own = String(diy.settings.get('CardClassBack', CopyFront));
        if (own !== CopyFront) return own;
        return String(diy.settings.get('CardClass', 'Guardian'));
    };

    InvestigatorBackFace.prototype.defaultValues = function (diy, faceIndex) {
        var values = { Unique: '1' };
        Standard.forEach(function (name, i) {
            values['Text' + (i + 1) + 'Name'] = name;
        });
        values.Text1 = '30.';
        return values;
    };

    InvestigatorBackFace.prototype.setDefaults = function (
        diy,
        faceIndex,
        keep
    ) {
        CardFace.prototype.setDefaults.call(this, diy, faceIndex, keep);
        this.setSettings(diy, true, { CardClass: 'Guardian', Subtitle: '' });
        this.setSettings(diy, keep, { CardClassBack: CopyFront });
    };

    InvestigatorBackFace.prototype.createClassPanel = function (
        bindings,
        faceIndex
    ) {
        var classes = [
            new ListItem(CopyFront, strings.string('AHLCG-LocIcon-CopyFront')),
        ].concat(FaceUtils.plugin().comboClassesI.slice(), [
            new ListItem('Story', strings.string('AHLCG-Class-Story')),
        ]);
        var list = new ui.comboBox(classes, null);
        this.bindKey(bindings, faceIndex, 'CardClassBack', list);
        var panel = new ui.Grid();
        panel.place(
            strings.string('AHLCG-Class'),
            'align right',
            list,
            'pushx, growx'
        );
        return panel;
    };

    InvestigatorBackFace.prototype.createTextPanels = function (
        bindings,
        faceIndex
    ) {
        var face = this;
        var suffix = this.suffix(faceIndex);
        var names = [];

        var presets = new ui.Grid();
        presets.setTitle(strings.string('AHLCG-Sections'));
        function preset(label, list) {
            var button = new ui.button(strings.string(label));
            button.addActionListener(function () {
                names.forEach(function (field, i) {
                    field.setText(list[i] || '');
                });
            });
            return button;
        }
        presets.place(
            preset('AHLCG-Standard', Standard),
            'pushx, growx',
            preset('AHLCG-TCUPrologue', Prologue),
            'pushx, growx'
        );

        var panel = new ui.Grid();
        panel.setTitle(strings.string('AHLCG-Rules'));
        function bind(key, control) {
            face.bindKey(bindings, faceIndex, key, control);
            return control;
        }
        for (let n = 1; n <= Sections; n++) {
            let name = bind(
                'Text' + n + 'Name' + suffix,
                new ui.textField('', 30)
            );
            names.push(name);
            let text = new ui.textArea('', 4, 30, true);
            panel.place(
                strings.string('AHLCG-Section') + ' ' + n,
                'align right',
                name,
                'wrap, pushx, growx',
                strings.string('AHLCG-Text'),
                'align right',
                bind('Text' + n + suffix, text),
                'wrap, pushx, growx, ' + FaceUtils.textAreaWidth(text)
            );
            if (n < Sections)
                panel.place(
                    strings.string('AHLCG-Spacing'),
                    'align right',
                    bind(
                        'Text' + n + suffix + 'Spacing',
                        new ui.spinner(0, 50, 1, 1)
                    ),
                    'wrap'
                );
        }
        var story = new ui.textArea('', 12, 30, true);
        panel.place(
            strings.string('AHLCG-Story'),
            'align right',
            bind('InvStory' + suffix, story),
            'pushx, growx, ' + FaceUtils.textAreaWidth(story)
        );

        var tab = new ui.Grid();
        tab.place(presets, 'wrap, pushx, growx', panel, 'wrap, pushx, growx');
        return tab;
    };

    InvestigatorBackFace.prototype.createInterface = function (
        diy,
        bindings,
        faceIndex
    ) {
        return {
            general: [
                {
                    panel: this.createTitlePanel(diy, bindings, faceIndex),
                    title: strings.string('AHLCG-Title'),
                },
                {
                    panel: this.createClassPanel(bindings, faceIndex),
                    title: strings.string('AHLCG-BasicData'),
                },
            ],
            tabs: [
                {
                    panel: this.createTextPanels(bindings, faceIndex),
                    title: strings.string('AHLCG-Rules'),
                },
            ],
        };
    };

    // the section headings
    InvestigatorBackFace.prototype.partFormats = function (diy, suffix) {
        var formats = {
            InvStory: ['<left>', '<iss>', '</iss>'],
        };
        for (let n = 1; n <= Sections; n++) {
            let name = String(
                diy.settings.get('Text' + n + 'Name' + suffix, '')
            );
            formats['Text' + n] = ['<left>', '<hdr>' + name + '</hdr>: ', ''];
        }
        return formats;
    };

    InvestigatorBackFace.prototype.paint = function (
        g,
        diy,
        sheet,
        boxes,
        collector,
        art
    ) {
        CardFace.prototype.paint.call(
            this,
            g,
            diy,
            sheet,
            boxes,
            collector,
            art
        );
    };

    InvestigatorBackFace.prototype.paintContent = function (
        g,
        diy,
        sheet,
        boxes,
        collector
    ) {
        var faceIndex = sheet.getSheetIndex();
        var className = this.cardClass(diy, faceIndex);
        var parallel = className.indexOf('Parallel') >= 0;
        var story = className === 'Story';

        if (story && !this.replaced)
            this.paintImage(
                g,
                diy,
                sheet,
                'overlays/AHLCG-Asset-EncounterSetOverlay.png',
                'Encounter-overlay'
            );
        this.paintName(
            g,
            diy,
            sheet,
            parallel ? boxes.parallelName : boxes.name
        );
        var subtitle = this.getSubtitle(diy, faceIndex);
        if (subtitle.length > 0)
            this.paintClassSubtitle(
                g,
                diy,
                parallel ? boxes.parallelSubtitle : boxes.subtitle,
                className,
                subtitle
            );

        var region = diy.settings.getRegion(
            this.key(diy.settings, 'Body-region')
        );
        var outline =
            Outlines[PlayerCard.artInitial(className).charAt(0)] || Outlines.N;
        boxes.body.pageShape = FaceUtils.polygonShape(
            region,
            outline[0],
            outline[1]
        );
        this.paintBody(g, diy, boxes.body, this.suffix(faceIndex));

        if (story)
            CollectorInfo.paintEncounterIcon(g, diy, sheet, this, collector);
    };

    return InvestigatorBackFace;
});
