const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const diy = path.join(__dirname, '../ArkhamHorrorLCG/ArkhamHorrorLCG/resources/ArkhamHorrorLCG/diy');
function load(name, modules, globals = {}) {
    let result;
    vm.runInNewContext(fs.readFileSync(path.join(diy, name), 'utf8'), {
        ...globals,
        define(deps, factory) { result = factory(...deps.map(name => modules[name])); },
    }, { filename: path.join(diy, name) });
    return result;
}

// --- built-in set icons painted from SVG -----------------------------------

function strangeImages(calls) {
    return {
        get(id) {
            return {
                paint(g, region, fit) { calls.push(['paint', id, region.name, fit]); },
                toBufferedImage(w, h, fit) { calls.push(['bitmap', id, w, h, fit]); return { bitmap: id, w, h, getWidth: () => w, getHeight: () => h }; },
            };
        },
    };
}

function collectorInfo(calls) {
    const types = {
        'java.awt.AlphaComposite': { DstOut: 'dstOut' },
        'java.awt.RenderingHints': {},
        'java.awt.Color': { BLACK: 'black' },
        'java.awt.geom.Ellipse2D$Double': function (...shape) {
            this.ellipse = shape;
        },
        'java.awt.geom.AffineTransform': {
            getTranslateInstance: (x, y) => ({ x, y, scale(sx, sy) { Object.assign(this, { sx, sy }); } }),
        },
        'ca.cgjennings.graphics.filters.InversionFilter': function () {
            this.filter = image => ({ inverted: image });
        },
        'resources.StrangeImage': strangeImages(calls),
    };
    const imageutils = {
        ImageUtils: {
            get: key => ({ image: key, getWidth: () => 36, getHeight: () => 33 }),
            create: (w, h) => {
                const image = { w, h, drawn: [], filled: [], getWidth: () => w, getHeight: () => h };
                image.createGraphics = () => ({
                    setRenderingHint() {},
                    setPaint(paint) { image.filled.push(paint); },
                    fill(shape) { image.filled.push(shape.ellipse); },
                    setComposite(composite) { image.drawn.push(composite); },
                    dispose() {},
                    drawImage(src, ...rest) { image.drawn.push([src, ...rest.slice(0, 4)]); },
                });
                return image;
            },
        },
    };
    return load('faces/CollectorInfo.js', {
        'faces/FaceUtils': { plugin: () => ({ collectionFontOffset: '0' }) },
        'se/imageutils': imageutils,
        'se/strings': {},
        'se/java': { type: name => types[name] },
    });
}

function settings(values) {
    return { get: (key, fallback) => values[key] ?? fallback ?? null, setRegion() {} };
}

function face(extra = {}) {
    return {
        collectorRegion: (_, name) => ({ name, x: 10, y: 20, width: 13, height: 13 }),
        ...extra,
    };
}

function graphics(scale = 1) {
    return {
        getTransform: () => ({ getScaleX: () => scale }),
        drawImage() {},
    };
}

test('a built-in encounter icon paints its SVG fit to the region', () => {
    const calls = [];
    collectorInfo(calls).paintEncounterIcon(
        graphics(), { settings: settings({ Encounter: 'TheGathering' }) }, {}, face(), { encounter: null }
    );
    assert.deepEqual(calls, [['paint', 'res://ArkhamHorrorLCG/icons/AHLCG-TheGathering.svg', 'EncounterIcon', true]]);
});

test('a return-to icon paints its own SVG in the return region', () => {
    const calls = [];
    collectorInfo(calls).paintEncounterIcon(
        graphics(), { settings: settings({ Encounter: 'ReturnToTheGathering' }) }, {}, face(), { encounter: null }
    );
    assert.deepEqual(calls, [
        ['paint', 'res://ArkhamHorrorLCG/icons/AHLCG-ReturnToTheGathering.svg', 'ReturnEncounterIcon', true],
    ]);
});

// a face whose return disc and own icon regions differ, as on a treachery
function fillFace() {
    const regions = {
        ReturnEncounterIcon: { x: 10, y: 20, width: 36, height: 33 },
        EncounterIcon: { x: 17.5, y: 25, width: 21, height: 21 },
    };
    return face({ fillReturnEncounterIcon: true, collectorRegion: (_, name) => ({ name, ...regions[name] }) });
}

test('a filled return-to disc is drawn at device pixels, cut to the region', () => {
    const drawn = [];
    const g = { getTransform: () => ({ getScaleX: () => 2 }), drawImage: (image, t) => drawn.push([image, t]) };
    collectorInfo([]).paintEncounterIcon(
        g, { settings: settings({ Encounter: 'ReturnToTheGathering' }) }, {}, fillFace(), { encounter: null }
    );
    const [[image, t]] = drawn;
    assert.deepEqual([image.w, image.h], [72, 66]);
    assert.deepEqual(image.filled, ['black', [0, 0, 72, 72]]);
    assert.deepEqual([t.x, t.y, t.sx, t.sy], [10, 20, 0.5, 0.5]);
});

test('a filled return-to disc cuts out the returned set icon where the face draws its own', () => {
    const calls = [];
    const drawn = [];
    const g = { getTransform: () => ({ getScaleX: () => 2 }), drawImage: image => drawn.push(image) };
    collectorInfo(calls).paintEncounterIcon(
        g,
        { settings: settings({ Encounter: 'ReturnToExtracurricularActivities' }) },
        {},
        fillFace(),
        { encounter: null }
    );
    const id = 'res://ArkhamHorrorLCG/icons/AHLCG-ExtracurricularActivity.svg';
    assert.deepEqual(calls, [['bitmap', id, 42, 42, true]]);
    const [composite, [icon, t]] = drawn[0].drawn;
    assert.equal(composite, 'dstOut');
    assert.equal(icon.bitmap, id);
    assert.deepEqual([t.x, t.y, t.sx, t.sy], [15, 10, 1, 1]);
});

test('a custom return-to icon is fit whole in the cut out, not stretched', () => {
    const drawn = [];
    const g = { getTransform: () => ({ getScaleX: () => 2 }), drawImage: image => drawn.push(image) };
    const tall = { getWidth: () => 10, getHeight: () => 20 };
    collectorInfo([]).paintEncounterIcon(
        g,
        { settings: settings({ Encounter: 'ReturnToTheGathering', EncounterType: '-1' }) },
        {},
        fillFace(),
        { encounter: { getImage: () => tall } }
    );
    const [, [icon, t]] = drawn[0].drawn;
    assert.equal(icon, tall);
    assert.deepEqual([t.x, t.y, t.sx, t.sy], [25.5, 10, 2.1, 2.1]);
});

test('a built-in collection icon is a bitmap at the pixels the region is drawn with', () => {
    const calls = [];
    const painted = [];
    const sheet = { getSheetIndex: () => 0, paintImage: (g, image, region) => painted.push([image, region.name]) };
    collectorInfo(calls).paintCollectionIcon(
        graphics(4), { settings: settings({ Collection: 'CoreSet' }) }, sheet, face({ invertCollectionIcon: true }), {}
    );
    const id = 'res://ArkhamHorrorLCG/icons/AHLCG-CoreSet.svg';
    assert.deepEqual(calls, [['bitmap', id, 52, 52, true]]);
    assert.deepEqual(JSON.parse(JSON.stringify(painted)), [[{ inverted: { bitmap: id, w: 52, h: 52 } }, 'CollectionIcon']]);
});

test('a collection icon is never rasterized below the region size', () => {
    const calls = [];
    const sheet = { getSheetIndex: () => 0, paintImage() {} };
    collectorInfo(calls).paintCollectionIcon(
        graphics(0.5), { settings: settings({ Collection: 'CoreSet' }) }, sheet, face(), {}
    );
    assert.deepEqual(calls.map(c => c.slice(2)), [[13, 13, true]]);
});

test('a custom collection icon is fit whole and centered at the drawn pixels', () => {
    const painted = [];
    const sheet = { getSheetIndex: () => 0, paintImage: (g, image, region) => painted.push([image, region.name]) };
    const tall = { getWidth: () => 10, getHeight: () => 20 };
    collectorInfo([]).paintCollectionIcon(
        graphics(4), { settings: settings({ CollectionType: '-1' }) }, sheet, face(), { collection: { getImage: () => tall } }
    );
    const [image, region] = painted[0];
    assert.equal(region, 'CollectionIcon');
    assert.deepEqual([image.w, image.h], [52, 52]);
    assert.deepEqual(image.drawn.map(d => d.slice(1)), [[13, 0, 26, 52]]);
});

test('a custom encounter icon is drawn from its clip with one scale, centered, without writing settings', () => {
    const ops = [];
    const g = {
        getTransform: () => 'saved',
        setTransform: t => ops.push(['set', t]),
        translate: (x, y) => ops.push(['translate', x, y]),
        scale: (x, y) => ops.push(['scale', x, y]),
    };
    const clip = { x: 100, y: 100, width: 28, height: 28, getWidth: () => 28, getHeight: () => 28 };
    const card = {
        settings: {
            get: (key, fallback) => ({ Encounter: 'CustomEncounterSet', EncounterType: '-1' })[key] ?? fallback,
            getRegion: key => (key === 'AHLCG-Face-Encounter-portrait-clip-region' ? clip : null),
            setRegion() { throw new Error('settings written while painting'); },
        },
    };
    const portrait = { paint: () => ops.push(['paint']) };
    collectorInfo([]).paintEncounterIcon(
        g, card, { getRenderTarget: () => 'target' },
        { collectorRegion: () => ({ x: 10, y: 20, width: 30, height: 20 }) },
        { encounter: portrait }
    );
    assert.deepEqual(ops, [
        ['translate', 15, 20],
        ['scale', 20 / 28, 20 / 28],
        ['translate', -100, -100],
        ['paint'],
        ['set', 'saved'],
    ]);
});

// --- set icon portraits fit whole ------------------------------------------

function recordingPortrait(key, minimum = false) {
    const p = {
        key,
        minimum,
        fired: 0,
        getBaseKey: () => key,
        getScaleUsesMinimum: () => p.minimum,
        setScaleUsesMinimum(value) { p.minimum = value; p.fired++; },
        installDefault() { p.installedMinimum = p.minimum; },
    };
    return p;
}

function faceHandler(extra = {}) {
    function DefaultPortrait(a, b) {
        const key = typeof a === 'string' ? a : b;
        return recordingPortrait(key, typeof a === 'string' ? b.minimum : false);
    }
    const types = { 'ca.cgjennings.apps.arkham.component.DefaultPortrait': DefaultPortrait, ...extra };
    return load('handlers/FaceHandler.js', {
        'core/ProjectDefaults': {}, 'handlers/CardVersion': {}, 'handlers/Collector': {},
        'handlers/TemplateReplacement': {}, 'faces/FaceUtils': {}, 'se/diy': {}, 'se/imageutils': {},
        'se/strings': {}, 'se/ui': {}, 'ui/Bindings': {}, 'require': () => ({}),
        'se/java': { type: name => types[name] || function () {} },
    });
}

test('a new set icon portrait fits its icon whole before its default is set', () => {
    const portrait = faceHandler().prototype.createPortrait({}, 'Encounter');
    assert.equal(portrait.installedMinimum, true);
});

test('a set icon portrait read from a save fits its icon whole', () => {
    const FaceHandler = faceHandler();
    const own = recordingPortrait('AHLCG-Face-Encounter');
    assert.equal(FaceHandler.prototype.adoptPortrait('Encounter', own), own);
    assert.equal(own.minimum, true);

    const legacy = recordingPortrait('AHLCG-Act-Encounter');
    const adopted = FaceHandler.prototype.adoptPortrait('Encounter', legacy);
    assert.equal(adopted.key, 'AHLCG-Face-Encounter');
    assert.equal(adopted.minimum, true);
});

test('a portrait that already fits whole is left unmodified', () => {
    const own = recordingPortrait('AHLCG-Face-Collection', true);
    faceHandler().prototype.adoptPortrait('Collection', own);
    assert.equal(own.fired, 0);
});

test('legacy set icon portraits fit whole; art still covers its region', () => {
    const made = {};
    function DefaultPortrait(_, key) {
        this.key = key;
        this.setScaleUsesMinimum = value => { made[key] = value; };
        this.installDefault = () => {};
    }
    const Portraits = load('legacy/Portraits.js', {
        'faces/FaceUtils': {}, 'faces/PortraitArt': {}, 'se/common': {}, 'se/imageutils': {},
        'se/strings': {}, 'se/ui': {},
        'se/java': { type: () => DefaultPortrait },
    });
    const card = {
        portraitTypes: ['Portrait-Front', 'Encounter-Both', 'Collection-Both', 'Portrait1-Front'],
        portraits: [],
        portraitIndex(key) { return this.portraitTypes.findIndex(t => t.startsWith(key + '-')); },
        key: (_, key, part) => 'AHLCG-Test-' + key + (part || ''),
        type: () => 'Test',
    };
    const store = { 'AHLCG-Test-Encounter-portrait-clip-region': '0,0,1,1' };
    Portraits.create(card, { settings: { get: (k, d) => store[k] ?? d ?? null, set(k, v) { store[k] = v; } } });
    assert.deepEqual(made, {
        'AHLCG-Test-Portrait-portrait-template': false,
        'AHLCG-Test-Encounter-portrait-template': true,
        'AHLCG-Test-Collection-portrait-template': true,
        'AHLCG-Test-Portrait1-portrait-template': true,
    });
});

// --- saved icons refit to the current clip ---------------------------------

function region(x, y, width, height) {
    return { x, y, width, height, equals: o => o != null && o.x === x && o.y === y && o.width === width && o.height === height };
}

function placed(scale, panX = 0, panY = 0, size = [100, 200], source = 'icon.svg') {
    const p = {
        scale, panX, panY, sets: [],
        getSource: () => source,
        getImage: () => ({ getWidth: () => size[0], getHeight: () => size[1] }),
        getScale: () => p.scale,
        getPanX: () => p.panX,
        getPanY: () => p.panY,
        setScale(v) { p.scale = v; p.sets.push('scale'); },
        setPanX(v) { p.panX = v; p.sets.push('panX'); },
        setPanY(v) { p.panY = v; p.sets.push('panY'); },
    };
    return p;
}

const OLD = region(171, 58, 34, 34);
const NEW = region(174, 61, 28, 28);

test('an icon an older version placed to cover its clip is fit whole in the new clip', () => {
    const refit = faceHandler().refitEncounter;
    const p = placed(Math.max(34 / 100, 34 / 200));
    refit(p, OLD, NEW, true);
    assert.equal(p.scale, Math.min(28 / 100, 28 / 200));
    assert.deepEqual(p.sets, ['scale']);
});

test('an older cover placement is refit even when the clip is unchanged', () => {
    const p = placed(Math.max(28 / 100, 28 / 200));
    faceHandler().refitEncounter(p, NEW, NEW, true);
    assert.equal(p.scale, 28 / 200);
});

test('an icon still fit to its clip is refit to the new clip', () => {
    const p = placed(Math.min(34 / 100, 34 / 200));
    faceHandler().refitEncounter(p, OLD, NEW, false);
    assert.equal(p.scale, 28 / 200);
    assert.deepEqual(p.sets, ['scale']);
});

test('a current card is never taken for a cover placement', () => {
    const p = placed(Math.max(34 / 100, 34 / 200));
    faceHandler().refitEncounter(p, OLD, NEW, false);
    assert.equal(p.scale, (34 / 100) * (28 / 34));
});

test('an icon placed by hand keeps its place, scaled to the new clip', () => {
    const p = placed(0.5, 6, -3);
    faceHandler().refitEncounter(p, OLD, NEW, true);
    const ratio = 28 / 34;
    assert.equal(p.scale, 0.5 * ratio);
    assert.equal(p.panX, 6 * ratio);
    assert.equal(p.panY, -3 * ratio);
});

test('an icon already in place, or with no image, is left unmodified', () => {
    const refit = faceHandler().refitEncounter;
    const fit = placed(28 / 200);
    refit(fit, NEW, NEW, false);
    refit(fit, null, NEW, false);
    const manual = placed(0.5, 6, -3);
    refit(manual, NEW, NEW, false);
    const empty = placed(1, 0, 0, [1, 1], '');
    refit(empty, OLD, NEW, true);
    refit(fit, OLD, null, true);
    refit(null, OLD, NEW, true);
    assert.deepEqual([fit.sets, manual.sets, empty.sets], [[], [], []]);
});

test('the encounter clip follows the reference region outside painting', () => {
    const FaceHandler = faceHandler();
    const values = { 'AHLCG-Face-Encounter-portrait-clip-region': OLD };
    const settings = {
        getRegion: key => values[key] ?? null,
        setRegion(key, value) { values[key] = value; },
    };
    const handler = Object.create(FaceHandler.prototype);
    handler.encounterReference = () => NEW;
    const p = placed(34 / 200);
    handler.updateEncounterClip({ settings }, p);
    assert.equal(values['AHLCG-Face-Encounter-portrait-clip-region'], NEW);
    assert.equal(p.scale, 28 / 200);

    settings.setRegion = () => { throw new Error('unchanged clip rewritten'); };
    handler.updateEncounterClip({ settings }, p);
    handler.encounterReference = () => null;
    handler.updateEncounterClip({ settings }, p);
});

test('the reference region is the first face icon region, in whole pixels', () => {
    function Region(bounds) { this.bounds = bounds; }
    const FaceHandler = faceHandler({ 'resources.Settings$Region': Region });
    const handler = Object.create(FaceHandler.prototype);
    const iconFace = name => ({
        key: (_, key) => name + '-' + key,
        collectorRegion: (_, key, fractional) => ({ getBounds: () => [name, key, fractional] }),
    });
    const settings = { get: key => (key === 'back-EncounterIcon-region' ? '1,2,3,4' : null) };
    handler.faces = [iconFace('front'), iconFace('back')];
    assert.deepEqual(handler.encounterReference({ settings }).bounds, ['back', 'EncounterIcon', true]);
    handler.faces = [iconFace('front'), null];
    assert.equal(handler.encounterReference({ settings }), null);
});
