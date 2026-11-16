const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const diy = path.join(__dirname, '../ArkhamHorrorLCG/ArkhamHorrorLCG/resources/ArkhamHorrorLCG/diy');
function load(name, modules) {
    let result;
    vm.runInNewContext(fs.readFileSync(path.join(diy, name), 'utf8'), {
        define(deps, factory) { result = factory(...deps.map(name => modules[name])); },
    }, { filename: path.join(diy, name) });
    return result;
}

// Java.type stands in for the classes the modules use.
const written = [];
const Java = {
    type: name => ({
        'java.io.File': class {
            constructor(file) { this.file = file; }
            canRead() { return this.file === 'readable.png'; }
            getAbsolutePath() { return this.file; }
            delete() {}
            static createTempFile() { return new this('temp.png'); }
        },
        'javax.imageio.ImageIO': { write: (image, format, file) => written.push([image, file.file]) },
    })[name] || {},
};
const Face = load('faces/Face.js', {
    'faces/FaceUtils': {}, 'se/common': {}, 'se/markup': {}, 'se/strings': {}, 'se/ui': {}, 'se/java': Java,
});

// arrays made in the module's context, as plain arrays
const plain = value => JSON.parse(JSON.stringify(value));

function settings(values) {
    return {
        values,
        get: (key, value) => values[key] ?? value ?? null,
        getOverride: key => values[key] ?? null,
        set: (key, value) => { values[key] = String(value); },
        reset: key => { delete values[key]; },
    };
}

// A card face: Rules and its spacing on each side, a BackType that holds
// 'Back' in its name, art, and a card-level Index.
function TestFace() { Face.call(this); }
TestFace.prototype = Object.create(Face.prototype);
TestFace.prototype.template = 'AHLCG-TestFace';
TestFace.prototype.portraits = ['Portrait'];
TestFace.prototype.usesCollection = true;
TestFace.prototype.usesTemplateReplacement = true;
TestFace.prototype.setDefaults = function (diy, faceIndex, keep) {
    var values = { Rules: '', BackType: 'x', Artist: '' };
    if (faceIndex !== 0) values.Title = '';
    this.setValues(diy, faceIndex, keep, values);
    this.setSettings(diy, keep, { ['Rules' + this.suffix(faceIndex) + 'Spacing']: '0', Index: '1' });
};
TestFace.prototype.extraSettings = function (diy, faceIndex) {
    return ['Extra' + this.suffix(faceIndex)];
};

const CardFace = load('faces/CardFace.js', {
    'faces/CollectorInfo': {}, 'faces/Face': Face, 'faces/FaceUtils': {}, 'faces/PortraitArt': {}, 'ui/SubtypeBinding': {},
    'se/common': {}, 'se/imageutils': {}, 'se/markup': {}, 'se/strings': {}, 'se/ui': {}, 'se/java': Java,
});

// a card face that shows the front's title, unique flag and subtitle on the
// back, as a key does
function TitledFace() { CardFace.call(this); }
TitledFace.prototype = Object.create(CardFace.prototype);
TitledFace.prototype.template = 'AHLCG-TitledFace';
TitledFace.prototype.portraits = [];
TitledFace.prototype.usesCollection = false;
TitledFace.prototype.usesEncounter = false;
TitledFace.prototype.usesCopyright = false;
TitledFace.prototype.usesTemplateReplacement = false;
TitledFace.prototype.copiesFrontTitle = true;
TitledFace.prototype.hasSubtitle = true;
TitledFace.prototype.parts = ['Rules'];

// a location back: its title is the card's unless it has one, and its icon
// can copy the front's
function LocationLike() { Face.call(this); }
LocationLike.prototype = Object.create(Face.prototype);
LocationLike.prototype.template = 'AHLCG-LocationLike';
LocationLike.prototype.setDefaults = function (diy, faceIndex, keep) {
    this.setValues(diy, faceIndex, keep, { Title: '', LocationIcon: 'None' });
};
LocationLike.prototype.getTitle = function (diy, faceIndex) {
    var title = Face.prototype.getTitle.call(this, diy, faceIndex);
    return title.length > 0 ? title : String(diy.name);
};

// an art-less face with no collector line
function PlainFace() { Face.call(this); }
PlainFace.prototype = Object.create(Face.prototype);
PlainFace.prototype.template = 'AHLCG-PlainFace';
PlainFace.prototype.setDefaults = function (diy, faceIndex, keep) {
    this.setValues(diy, faceIndex, keep, { BackType: 'plain' });
};

test('settingPairs pairs each side key, art, template replacement and collector flags', () => {
    const pairs = new TestFace().settingPairs({ name: 'Card', settings: settings({}) });
    assert.deepEqual(plain(pairs), [
        ['Rules', 'RulesBack'],
        ['BackType', 'BackTypeBack'],
        ['Artist', 'ArtistBack'],
        ['RulesSpacing', 'RulesBackSpacing'],
        ['Extra', 'ExtraBack'],
        ['AHLCG-TestFace-Portrait-MirrorEdges', 'AHLCG-TestFace-BackPortrait-MirrorEdges'],
        ['TemplateReplacement', 'TemplateReplacementBack'],
        ['ShowCollectionNumberFront', 'ShowCollectionNumberBack'],
    ]);
});

test('settingPairs leaves out the back title, which the front holds as the name', () => {
    const pairs = new TestFace().settingPairs({ name: 'Card', settings: settings({}) });
    assert.ok(!pairs.some(pair => pair.includes('TitleBack')));
});

test('sharedSettings lists keys both sides set alike', () => {
    assert.deepEqual(plain(new TestFace().sharedSettings({ name: 'Card', settings: settings({}) })), ['Index']);
    assert.deepEqual(plain(new PlainFace().sharedSettings({ name: 'Card', settings: settings({}) })), []);
});

test('sideSettings records setDefaults without changing the component', () => {
    const values = { Rules: 'kept' };
    const keys = new TestFace().sideSettings({ name: 'Card', settings: settings(values) }, 1);
    assert.deepEqual(plain(keys), ['RulesBack', 'BackTypeBack', 'ArtistBack', 'TitleBack', 'RulesBackSpacing', 'Index', 'ExtraBack']);
    assert.deepEqual(values, { Rules: 'kept' });
});

test('collectorSettings follows what the face draws', () => {
    const face = new TestFace();
    assert.deepEqual(plain(face.collectorSettings()), ['Collection', 'CollectionType', 'CollectionNumber', 'flipSuffix', 'TemplateReplacementBleed']);
    face.usesEncounter = true;
    face.usesCopyright = true;
    face.usesCollection = false;
    face.usesTemplateReplacement = false;
    assert.deepEqual(plain(face.collectorSettings()), ['Encounter', 'EncounterType', 'EncounterNumber', 'EncounterTotal', 'Copyright']);
    assert.deepEqual(plain(new PlainFace().collectorSettings()), []);
});

const FlexibleScript = 'ArkhamHorrorLCG/diy/Flexible.js';
const Choices = [
    { id: 'playerBack', face: PlainFace },
    { id: 'encounterBack', face: PlainFace },
    { id: 'test', face: TestFace },
    { id: 'titled', face: TitledFace },
    { id: 'location', face: LocationLike },
];
const FaceComposer = load('handlers/FaceComposer.js', { 'handlers/FlexibleFaces': { choices: Choices }, 'se/java': Java });

function portrait(key, source) {
    return {
        key, source, image: 'image-' + key, pan: [0, 0], rotation: 0, scale: 1,
        getBaseKey() { return this.key; },
        getSource() { return this.source; },
        setSource(source) { this.source = source; },
        getImage() { return this.image; },
        getPanX() { return this.pan[0]; }, getPanY() { return this.pan[1]; },
        setPanX(x) { this.pan[0] = x; }, setPanY(y) { this.pan[1] = y; },
        getRotation() { return this.rotation; }, setRotation(r) { this.rotation = r; },
        getScale() { return this.scale; }, setScale(s) { this.scale = s; },
        equals(other) { return other === this; },
    };
}

function card(name, values, portraits = [], script = FlexibleScript) {
    return {
        name,
        settings: settings(values),
        portraits,
        getName() { return this.name; },
        setName(name) { this.name = name; },
        getHandlerScript() { return script; },
        getPortraitCount() { return this.portraits.length; },
        getPortrait(i) { return this.portraits[i]; },
        equals(other) { return other === this; },
    };
}

// the converted card's FaceChoiceHandler: faces from the settings, and art
// portraits for them on applyFaceSettings
function handler(target, faces) {
    return {
        faces,
        applied: 0,
        applyFaceSettings(diy) {
            this.applied++;
            this.faces = ['FrontFace', 'BackFace'].map(key => new (Choices.find(c => c.id === diy.settings.get(key)).face)());
            this.faces.forEach((face, i) => face.portraits.forEach(name => {
                const key = face.portraitKey(i, name);
                if (!diy.portraits.some(p => p.key === key)) diy.portraits.push(portrait(key, null));
            }));
        },
        findPortrait(kind) { return target.portraits.find(p => p.key === 'AHLCG-Face-' + kind) || null; },
    };
}

function session(source, target, faces) {
    return {
        calls: [],
        cancelled: null,
        composed: 0,
        getSource: () => source,
        getTarget: () => target,
        getTrigger() {
            return {
                getCause: () => FaceComposer.Cause,
                getFaceComponent: i => faces[i][0],
                getFaceSide: i => faces[i][1],
                composed: () => { this.composed++; },
            };
        },
        cancel(reason) { this.cancelled = reason; },
        disableAutomaticCopyBasics() { this.calls.push('basics'); },
        copyComment() { this.calls.push('comment'); },
        copyExpansions() { this.calls.push('expansions'); },
    };
}

test('isComposing needs the cause and the face methods', () => {
    const s = session(null, null, []);
    assert.equal(FaceComposer.isComposing(s), true);
    s.getTrigger = () => ({ getCause: () => 'manual' });
    assert.equal(FaceComposer.isComposing(s), false);
    s.getTrigger = () => ({ getCause: () => FaceComposer.Cause });
    assert.equal(FaceComposer.isComposing(s), false);
});

test('a back from another card brings its settings, art and face id', () => {
    const source = card('Hall', {});
    const target = card('Hall', {
        FrontFace: 'test', BackFace: 'test', Rules: 'front rules', RulesBack: 'old back', BackTypeBack: 'old',
        TitleBack: 'Old', Index: '1', 'AHLCG-TestFace-BackPortrait-MirrorEdges': 'Enable',
    }, [portrait('AHLCG-TestFace-Portrait', 'front.png'), portrait('AHLCG-TestFace-BackPortrait', 'old.png')]);
    const other = card('Vault', {
        FrontFace: 'test', BackFace: 'test', RulesBack: 'vault back', ExtraBack: 'extra', TitleBack: 'Vault Door',
        Index: '1', ArtistBack: 'Someone',
    }, [portrait('AHLCG-TestFace-BackPortrait', 'readable.png')]);
    other.portraits[0].pan = [3, 4];
    const h = handler(target, [new TestFace(), new TestFace()]);
    const s = session(source, target, [[source, 0], [other, 1]]);

    FaceComposer.compose(h, target, s);

    assert.equal(s.cancelled, null);
    assert.equal(s.composed, 1);
    const v = target.settings.values;
    assert.equal(v.Rules, 'front rules');
    assert.equal(v.RulesBack, 'vault back');
    assert.equal(v.ExtraBack, 'extra');
    assert.equal(v.ArtistBack, 'Someone');
    assert.equal(v.TitleBack, 'Vault Door');
    assert.equal(v.BackTypeBack, undefined);
    assert.equal(v['AHLCG-TestFace-BackPortrait-MirrorEdges'], undefined);
    assert.equal(v.BackFace, 'test');
    assert.equal(v.PortraitShare, '0');
    assert.equal(target.name, 'Hall');
    assert.deepEqual(s.calls, []);
    const back = target.portraits.find(p => p.key === 'AHLCG-TestFace-BackPortrait');
    assert.equal(back.source, 'readable.png');
    assert.deepEqual(back.pan, [3, 4]);
    assert.equal(h.applied, 1);
});

test('a front from another card\'s back takes its keys, title and the source\'s comment', () => {
    const source = card('Hall', {});
    const target = card('Hall', { FrontFace: 'test', BackFace: 'playerBack', Rules: 'old', BackTypeBack: 'plain' });
    const other = card('Vault', { FrontFace: 'playerBack', BackFace: 'test', RulesBack: 'moved', RulesBackSpacing: '2', TitleBack: 'Vault Door' });
    const h = handler(target, [new TestFace(), new PlainFace()]);
    const s = session(source, target, [[other, 1], [source, 1]]);

    FaceComposer.compose(h, target, s);

    const v = target.settings.values;
    assert.equal(target.name, 'Vault Door');
    assert.equal(v.Rules, 'moved');
    assert.equal(v.RulesSpacing, '2');
    assert.equal(v.RulesBack, undefined);
    assert.equal(v.BackTypeBack, 'plain');
    assert.deepEqual(s.calls, ['basics', 'comment', 'expansions']);
});

test('a back that showed its front\'s title, unique flag and subtitle keeps them', () => {
    const source = card('Hall', {});
    const target = card('Hall', { FrontFace: 'test', BackFace: 'test' });
    const other = card('Key of Ys', { FrontFace: 'titled', BackFace: 'titled', Unique: '1', Subtitle: 'Sub', RulesBack: 'r' });
    const h = handler(target, [new TestFace(), new TestFace()]);

    FaceComposer.compose(h, target, session(source, target, [[source, 0], [other, 1]]));

    const v = target.settings.values;
    assert.equal(v.TitleBack, 'Key of Ys');
    assert.equal(v.UniqueBack, '1');
    assert.equal(v.SubtitleBack, 'Sub');
});

test('a kept back that showed the front\'s title keeps it when the front changes', () => {
    const source = card('Key of Ys', {});
    const target = card('Key of Ys', { FrontFace: 'titled', BackFace: 'titled', Unique: '1', Subtitle: 'Sub' });
    const other = card('Vault', { FrontFace: 'test', BackFace: 'test', Rules: 'vault' });
    const h = handler(target, [new TitledFace(), new TitledFace()]);

    FaceComposer.compose(h, target, session(source, target, [[other, 0], [source, 1]]));

    const v = target.settings.values;
    assert.equal(target.name, 'Vault');
    assert.equal(v.TitleBack, 'Key of Ys');
    assert.equal(v.UniqueBack, '1');
    assert.equal(v.SubtitleBack, 'Sub');
    assert.equal(v.Rules, 'vault');
});

test('a kept back that shared the front\'s art keeps it as its own', () => {
    const source = card('Hall', {});
    const target = card('Hall', { FrontFace: 'test', BackFace: 'test', PortraitShare: '1', Artist: 'Front Artist',
        'AHLCG-TestFace-Portrait-MirrorEdges': 'Disable' },
    [portrait('AHLCG-TestFace-Portrait', 'readable.png'), portrait('AHLCG-TestFace-BackPortrait', null)]);
    const other = card('Vault', { FrontFace: 'test', BackFace: 'test' }, [portrait('AHLCG-TestFace-Portrait', 'vault.png')]);
    const h = handler(target, [new TestFace(), new TestFace()]);

    FaceComposer.compose(h, target, session(source, target, [[other, 0], [source, 1]]));

    const v = target.settings.values;
    assert.equal(v.PortraitShare, '0');
    assert.equal(v.ArtistBack, 'Front Artist');
    assert.equal(v['AHLCG-TestFace-BackPortrait-MirrorEdges'], 'Disable');
    assert.equal(target.portraits.find(p => p.key === 'AHLCG-TestFace-BackPortrait').source, 'readable.png');
});

test('a back from a card whose back shared its front\'s art brings the front\'s art', () => {
    const source = card('Hall', {});
    const target = card('Hall', { FrontFace: 'playerBack', BackFace: 'encounterBack' });
    const other = card('Vault', { FrontFace: 'test', BackFace: 'test', PortraitShare: '1', Artist: 'Vault Artist' },
        [portrait('AHLCG-TestFace-Portrait', 'gone.png'), portrait('AHLCG-TestFace-BackPortrait', 'unused.png')]);
    written.length = 0;
    const h = handler(target, [new PlainFace(), new PlainFace()]);

    FaceComposer.compose(h, target, session(source, target, [[source, 0], [other, 1]]));

    const back = target.portraits.find(p => p.key === 'AHLCG-TestFace-BackPortrait');
    assert.equal(back.source, 'temp.png');
    assert.deepEqual(written, [['image-AHLCG-TestFace-Portrait', 'temp.png']]);
    assert.equal(target.settings.values.ArtistBack, 'Vault Artist');
});

test('shared settings that differ cancel the conversion', () => {
    const source = card('Hall', {});
    const target = card('Hall', { FrontFace: 'test', BackFace: 'test', Index: '1', Rules: 'front' });
    const other = card('Vault', { FrontFace: 'test', BackFace: 'test', Index: '2' });
    const s = session(source, target, [[source, 0], [other, 1]]);

    FaceComposer.compose(handler(target, [new TestFace(), new TestFace()]), target, s);

    assert.equal(s.cancelled, 'conflicting settings: Index (1 / 2)');
    assert.equal(s.composed, 0);
    assert.equal(target.settings.values.Rules, 'front');
    assert.equal(target.settings.values.BackFace, 'test');
});

test('a face from a card that is not flexible cancels the conversion', () => {
    const source = card('Hall', {});
    const target = card('Hall', { FrontFace: 'test', BackFace: 'test' });
    const legacy = card('Old', {}, [], 'ArkhamHorrorLCG/diy/Location.js');
    const s = session(source, target, [[source, 0], [legacy, 1]]);

    FaceComposer.compose(handler(target, [new TestFace(), new TestFace()]), target, s);

    assert.equal(s.cancelled, 'not a flexible card: Old');
    assert.equal(s.composed, 0);
});

test('nothing changes when both sides are the source\'s own', () => {
    const source = card('Hall', {});
    const target = card('Hall', { FrontFace: 'test', BackFace: 'test', Rules: 'r' });
    const h = handler(target, [new TestFace(), new TestFace()]);
    const s = session(source, target, [[source, 0], [source, 1]]);

    FaceComposer.compose(h, target, s);

    assert.deepEqual(target.settings.values, { FrontFace: 'test', BackFace: 'test', Rules: 'r' });
    assert.equal(h.applied, 0);
    assert.equal(s.composed, 1);
});

test('the collector line stays the source\'s while the other face draws it', () => {
    const source = card('Hall', {});
    const target = card('Hall', { FrontFace: 'test', BackFace: 'playerBack', Collection: 'Core', CollectionNumber: '12' },
        [portrait('AHLCG-Face-Collection', 'core.png')]);
    const other = card('Vault', { FrontFace: 'test', BackFace: 'test', Collection: 'Dunwich', CollectionNumber: '45' },
        [portrait('AHLCG-Face-Collection', 'readable.png')]);

    FaceComposer.compose(handler(target, [new TestFace(), new PlainFace()]), target, session(source, target, [[source, 0], [other, 1]]));

    assert.equal(target.settings.values.Collection, 'Core');
    assert.equal(target.settings.values.CollectionNumber, '12');
    assert.equal(target.portraits[0].source, 'core.png');
});

test('the collector line comes with a face when the other face draws none', () => {
    const source = card('Hall', {});
    const target = card('Hall', { FrontFace: 'playerBack', BackFace: 'playerBack', Collection: 'Core' },
        [portrait('AHLCG-Face-Collection', 'core.png')]);
    const other = card('Vault', { FrontFace: 'test', BackFace: 'test', Collection: 'Dunwich', CollectionNumber: '45' },
        [portrait('AHLCG-Face-Collection', 'readable.png')]);

    FaceComposer.compose(handler(target, [new PlainFace(), new PlainFace()]), target, session(source, target, [[source, 0], [other, 1]]));

    assert.equal(target.settings.values.Collection, 'Dunwich');
    assert.equal(target.settings.values.CollectionNumber, '45');
    assert.equal(target.portraits[0].source, 'readable.png');
});

test('inheritedSettings writes out what a back shows from the front', () => {
    const key = { name: 'Key of Ys', settings: settings({ Unique: '1', Subtitle: 'Sub', TitleBack: '', SubtitleBack: '' }) };
    assert.deepEqual(plain(new TitledFace().inheritedSettings(key, 1)), { TitleBack: 'Key of Ys', UniqueBack: '1', SubtitleBack: 'Sub' });
    assert.deepEqual(plain(new TitledFace().inheritedSettings(key, 0)), {});
    const titled = { name: 'Key of Ys', settings: settings({ Subtitle: 'Sub', TitleBack: 'Other', SubtitleBack: '' }) };
    assert.deepEqual(plain(new TitledFace().inheritedSettings(titled, 1)), { SubtitleBack: 'Sub' });
    const own = { name: 'Key of Ys', settings: settings({ TitleBack: 'Other', SubtitleBack: 'Mine' }) };
    assert.deepEqual(plain(new TitledFace().inheritedSettings(own, 1)), {});
});

test('inheritedSettings takes a copied front value and a fallback title', () => {
    const hall = { name: 'Hall', settings: settings({ LocationIcon: 'Circle', LocationIconBack: 'Copy front' }) };
    assert.deepEqual(plain(new LocationLike().inheritedSettings(hall, 1)), { TitleBack: 'Hall', LocationIconBack: 'Circle' });
    const none = { name: 'Hall', settings: settings({ TitleBack: 'Cellar', LocationIconBack: 'Copy front' }) };
    assert.deepEqual(plain(new LocationLike().inheritedSettings(none, 1)), { LocationIconBack: 'None' });
    const copies = { name: 'Hall', settings: settings({ TitleBack: 'Cellar', LocationIcon: 'Copy front', LocationIconBack: 'Copy front' }) };
    assert.deepEqual(plain(new LocationLike().inheritedSettings(copies, 1)), { LocationIconBack: 'None' });
});

test('a kept location back keeps the front\'s title and icon when the front changes', () => {
    const source = card('Hall', {});
    const target = card('Hall', { FrontFace: 'location', BackFace: 'location', LocationIcon: 'Circle', LocationIconBack: 'Copy front' });
    const other = card('Vault', { FrontFace: 'test', BackFace: 'test', Rules: 'vault' });

    FaceComposer.compose(handler(target, [new LocationLike(), new LocationLike()]), target, session(source, target, [[other, 0], [source, 1]]));

    const v = target.settings.values;
    assert.equal(target.name, 'Vault');
    assert.equal(v.TitleBack, 'Hall');
    assert.equal(v.LocationIconBack, 'Circle');
    assert.equal(v.LocationIcon, undefined);
});

test('a location back moved to the front takes its shown title and copied icon', () => {
    const source = card('Hall', {});
    const target = card('Hall', { FrontFace: 'test', BackFace: 'test' });
    const other = card('Cellar', { FrontFace: 'location', BackFace: 'location', LocationIcon: 'Square', LocationIconBack: 'Copy front' });

    FaceComposer.compose(handler(target, [new TestFace(), new TestFace()]), target, session(source, target, [[other, 1], [source, 1]]));

    assert.equal(target.name, 'Cellar');
    assert.equal(target.settings.values.LocationIcon, 'Square');
});

test('a location back that copies a front with nothing to copy keeps its icon circle', () => {
    function LocationFace() { CardFace.call(this); }
    LocationFace.prototype = Object.create(CardFace.prototype);
    const LocationBackFace = load('faces/LocationBackFace.js', {
        'faces/CardFace': CardFace, 'faces/CollectorInfo': {}, 'faces/Face': Face, 'faces/FaceUtils': {},
        'faces/LocationFace': LocationFace, 'faces/LocationParts': {}, 'se/strings': {},
    });
    const face = new LocationBackFace();
    assert.equal(face.copiedValue('LocationIconBack', 'Copy front'), 'Empty');
    assert.equal(face.copiedValue('LocationIconBack', 'Circle'), 'Circle');
    assert.equal(face.copiedValue('Connection1IconBack', 'Copy front'), 'None');
    assert.equal(face.copiedValue('Connection1IconBack', 'Square'), 'Square');
});
