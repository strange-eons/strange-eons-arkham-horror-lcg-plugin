// The base of the legacy card handlers: a card per handler from the component
// settings, the handler's own portraits, and helpers that pass that card on.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const diy = path.join(__dirname, '../ArkhamHorrorLCG/ArkhamHorrorLCG/resources/ArkhamHorrorLCG/diy');
function load(name, modules) {
    let result;
    vm.runInNewContext(fs.readFileSync(path.join(diy, name), 'utf8'), {
        define(deps, factory) {
            result = typeof deps === 'function' ? deps() : factory(...deps.map(dep => modules[dep]));
        },
    }, { filename: path.join(diy, name) });
    return result;
}

const Card = load('legacy/Card.js', {});

function settings(values = {}) {
    const map = new Map(Object.entries(values));
    return {
        get: key => (map.has(key) ? map.get(key) : null),
        getTextStyle: key => 'style:' + key,
        getTextAlignment: key => 'align:' + key,
    };
}

// each delegate records its name and arguments
function recorder(calls, names) {
    return Object.fromEntries(names.map(name => [name, (...args) => (calls.push([name, ...args]), name)]));
}

function loadHandler() {
    const calls = [];
    const modules = {
        'faces/FaceUtils': recorder(calls, ['initBodyTags', 'initCopyrightTags']),
        'guide/GuideBody': recorder(calls, ['paint']),
        'guide/GuidePage': recorder(calls, [
            'initTags', 'setupPortrait', 'bodyRegions', 'paintTemplate', 'paintPortraits', 'paintPageNumber',
        ]),
        'guide/GuidePanels': recorder(calls, ['title', 'stats', 'portraits']),
        'handlers/CardVersion': 42,
        'legacy/Card': Card,
        'legacy/CollectorLine': recorder(calls, ['paint', 'paintArtist', 'paintEncounterIcon', 'paintWatermark']),
        'legacy/ImageFilters': recorder(calls, ['greyscale']),
        'legacy/Panels': recorder(calls, [
            'title', 'title2', 'titleUnique', 'concealedStats', 'copyright', 'text', 'tint', 'portraits',
            'collection', 'encounter', 'simpleEncounter',
        ]),
        'legacy/Portraits': {
            ...recorder(calls, ['paint', 'write']),
            create(card) {
                card.portraitTypes.forEach((type, i) => (card.portraits[i] = type));
            },
            read(card, diy, ois, readEncounter) {
                calls.push(['read', readEncounter]);
                card.portraitTypes.forEach((type, i) => (card.portraits[i] = ois.readObject()));
            },
        },
        'legacy/Sets': recorder(calls, [
            'setDefaultEncounter', 'setDefaultCollection', 'updateCollection', 'updateEncounter',
        ]),
        'legacy/Templates': {
            ...recorder(calls, ['clear', 'paintFront', 'paintBack', 'paintFullBleed']),
            templateKey: name => 'AHLCG-' + name + '-template',
        },
        'legacy/Text': recorder(calls, ['name', 'twoLineName', 'singleLine', 'body']),
        'se/markup': { markupBox: sheet => ({ sheet }) },
    };
    return { LegacyHandler: load('legacy/LegacyHandler.js', modules), calls };
}

function handler(LegacyHandler) {
    return new LegacyHandler(['Guide75'], [''], ['Portrait1-Front', 'Portrait2-Front']);
}

test('constants', () => {
    const { LegacyHandler } = loadHandler();
    assert.equal(LegacyHandler.FACE_FRONT, 0);
    assert.equal(LegacyHandler.FACE_BACK, 1);
    assert.equal(LegacyHandler.CARD_VERSION, 42);
});

test('attach makes one card per handler from the component settings', () => {
    const { LegacyHandler } = loadHandler();
    const h = handler(LegacyHandler);
    const first = h.attach({ settings: settings({ 'AHLCG-Guide75-Name-style': 'x', Page: '3' }) });
    assert.equal(h.attach({ settings: settings() }), first);
    assert.equal(h.get('Page'), '3');
    assert.equal(h.get('Missing'), null);
    assert.equal(h.key(0, 'Name', '-style'), 'AHLCG-Guide75-Name');
    assert.equal(h.key(0, 'Body', '-style'), 'AHLCG-Body');
});

test('handlers keep their own portraits', () => {
    const { LegacyHandler } = loadHandler();
    const a = handler(LegacyHandler);
    const b = handler(LegacyHandler);
    a.attach({ settings: settings() });
    b.attach({ settings: settings() });
    a.createPortraits({});
    assert.equal(a.getPortraitCount(), 2);
    assert.equal(b.getPortraitCount(), 0);
    assert.equal(a.getPortrait(1), 'Portrait2-Front');
    assert.equal(a.portraitIndex('Portrait2'), 1);
    assert.throws(() => a.getPortrait(2), /Invalid portrait index: 2/);
    assert.throws(() => a.getPortrait(-1), /Invalid portrait index: -1/);
});

test('portraits are read with the encounter portrait and written in order', () => {
    const { LegacyHandler, calls } = loadHandler();
    const h = handler(LegacyHandler);
    h.attach({ settings: settings() });
    const saved = ['one', 'two'];
    h.readPortraits({}, { readObject: () => saved.shift() });
    assert.deepEqual(calls, [['read', true]]);
    assert.equal(h.getPortrait(0), 'one');
    h.onWrite({}, 'oos');
    assert.deepEqual(calls[1][0], 'write');
    assert.equal(calls[1][1], h.card);
    assert.equal(calls[1][2], 'oos');
});

test('box styles from the front face key, aligned by its own or another name', () => {
    const { LegacyHandler } = loadHandler();
    const h = handler(LegacyHandler);
    const d = { settings: settings({ 'AHLCG-Guide75-ResHeader-style': 'x' }) };
    h.attach(d);
    assert.deepEqual({ ...h.box(d, 'sheet', 'Name') }, {
        sheet: 'sheet', defaultStyle: 'style:AHLCG-Name-style', alignment: 'align:AHLCG-Name-alignment',
    });
    assert.deepEqual({ ...h.box(d, 'sheet', 'ResHeader', 'Header') }, {
        sheet: 'sheet', defaultStyle: 'style:AHLCG-Guide75-ResHeader-style', alignment: 'align:AHLCG-Header-alignment',
    });
});

test('helpers pass the handler card to the legacy modules', () => {
    const { LegacyHandler, calls } = loadHandler();
    const h = handler(LegacyHandler);
    const d = { settings: settings() };
    const card = h.attach(d);
    const cases = [
        [() => h.paintPortrait('g', d, 's', 'P'), ['paint', card, 'g', d, 's', 'P']],
        [() => h.greyscale('img'), ['greyscale', 'img']],
        [() => h.setDefaultEncounter(d), ['setDefaultEncounter', card, d]],
        [() => h.setDefaultCollection(d), ['setDefaultCollection', card, d]],
        [() => h.updateCollection(d), ['updateCollection', card, d]],
        [() => h.updateEncounter(d), ['updateEncounter', card, d]],
        [() => h.clearImage('g', 's'), ['clear', 'g', 's']],
        [() => h.drawTemplate('g', 's'), ['paintFront', card, 'g', 's']],
        [() => h.drawBackTemplate('g', 's', 'Player'), ['paintBack', card, 'g', 's', 'Player']],
        [() => h.drawFullBleed('g', 's', 'Boon-Common'), ['paintFullBleed', card, 'g', 's', 'AHLCG-Boon-Common-template']],
        [() => h.initBodyTags(d, 'b'), ['initBodyTags', d, 'b']],
        [() => h.initCopyrightTags(d, 'b'), ['initCopyrightTags', d, 'b']],
        [() => h.drawName('g', d, 's', 'b'), ['name', card, 'g', d, 's', 'b']],
        [() => h.draw2LineName('g', d, 's', 'b'), ['twoLineName', card, 'g', d, 's', 'b']],
        [() => h.drawLine('g', d, 's', 'b', 'Trait', 't'), ['singleLine', card, 'g', d, 's', 'b', 'Trait', 't']],
        [() => h.drawBody('g', d, 's', 'b', ['Rules']), ['body', card, 'g', d, 's', 'b', ['Rules']]],
        [() => h.drawArtist('g', d, 's', 'b', true), ['paintArtist', card, 'g', d, 's', 'b', true]],
        [() => h.drawCollectorInfo('g', d, 's', 1, 2, 3, 4, 5, 6), ['paint', card, 'g', d, 's', 1, 2, 3, 4, 5, 6]],
        [() => h.drawEncounterIcon('g', d, 's'), ['paintEncounterIcon', card, 'g', d, 's']],
        [() => h.drawWatermark('g', d, 's'), ['paintWatermark', card, 'g', d, 's']],
        [() => h.initGuideTags(d, 'b'), ['initTags', d, 'b']],
        [() => h.setupGuidePortrait(d, 1, 'Top', true), ['setupPortrait', card, d, 1, 'Top', true]],
        [() => h.guideBodyRegions(d, 'r'), ['bodyRegions', card, 'r']],
        [() => h.drawGuideTemplate('g', d, 's', 'b'), ['paintTemplate', card, 'g', d, 's', 'b']],
        [() => h.drawGuidePortraits('g', d, 's'), ['paintPortraits', card, 'g', d, 's']],
        [() => h.drawPageNumber('g', d, 's', 'b'), ['paintPageNumber', card, 'g', d, 's', 'b']],
        [() => h.drawGuideBody('g', d, 's', 'b', 'h', 'r', 't', 100), ['paint', card, 'g', d, 's', 'b', 'h', 'r', 't', 100]],
        [() => h.layoutTitle(d, 'B', true, [0], 0), ['title', card, d, 'B', true, [0], 0]],
        [() => h.layoutTitle2(d, 'B', [0], 0), ['title2', card, d, 'B', [0], 0]],
        [() => h.layoutTitleUnique(d, 'B', true, [0], 0), ['titleUnique', card, d, 'B', true, [0], 0]],
        [() => h.layoutTitleGuide(d, 'B', [0], 0, 'p'), ['title', card, d, 'B', [0], 0, 'p']],
        [() => h.layoutGuideStats('B', 0), ['stats', card, 'B', 0]],
        [() => h.layoutConcealedStats('B', 0), ['concealedStats', card, 'B', 0]],
        [() => h.layoutCopyright('B', false, [0]), ['copyright', 'B', false, [0]]],
        [() => h.layoutText('B', ['Rules'], 'Left', 0), ['text', card, 'B', ['Rules'], 'Left', 0]],
        [() => h.layoutTint('B'), ['tint', 'B']],
        [() => h.layoutPortraits(d, 'B', 'P', null, true, false, false), ['portraits', card, d, 'B', 'P', null, true, false, false]],
        [() => h.layoutGuidePortraits(d, 'B', 'L', 'R', true), ['portraits', card, d, 'B', 'L', 'R', true]],
        [() => h.layoutCollection('B', 'p', false, false, [0], 0), ['collection', card, 'B', 'p', false, false, [0], 0]],
        [() => h.layoutEncounter('B', 'p', false, [0], [1], 0), ['encounter', card, 'B', 'p', false, [0], [1], 0]],
        [() => h.layoutSimpleEncounter('B', 'p', [0, 1], 0), ['simpleEncounter', card, 'B', 'p', [0, 1], 0]],
    ];
    for (const [call, expected] of cases) {
        calls.length = 0;
        const result = call();
        assert.deepEqual(calls, [expected], expected[0]);
        if (result !== undefined) assert.equal(result, expected[0]);
    }
});

// a handler class subclassing a recording LegacyHandler
function loadSubclass(name, extra = {}) {
    const calls = [];
    function LegacyHandler(types, suffixes, portraitTypes) {
        Object.assign(this, { types, suffixes, portraitTypes, portraits: [], boxes: {} });
    }
    LegacyHandler.FACE_FRONT = 0;
    LegacyHandler.CARD_VERSION = 42;
    const record = method => function (...args) {
        calls.push([method, ...args]);
        return method;
    };
    for (const method of [
        'attach', 'key', 'createPortraits', 'readPortraits', 'clearImage', 'drawBackTemplate', 'drawName',
        'initBodyTags', 'initGuideTags', 'setupGuidePortrait', 'drawGuideTemplate', 'drawGuidePortraits',
        'drawPageNumber', 'drawGuideBody', 'layoutTint', 'layoutTitle2', 'layoutTitleGuide', 'layoutGuideStats',
        'layoutText',
    ])
        LegacyHandler.prototype[method] = record(method);
    LegacyHandler.prototype.box = (diy, sheet, style, align) => ({
        style, align, setTextFitting(f) { this.fit = f; },
    });
    LegacyHandler.prototype.guideBodyRegions = (diy, regions) => regions.map(r => 'fitted ' + r);
    LegacyHandler.prototype.layoutPortraits = (diy, b, name) => [{ addToEditor: (e, t) => calls.push(['tab', t, name]) }];
    LegacyHandler.prototype.layoutGuidePortraits = () => [{ addToEditor: (e, t) => calls.push(['tab', t]) }, 'p1', 'p2'];
    function Grid() {
        this.place = () => {};
        this.addToEditor = (e, t) => calls.push(['tab', t]);
        this.setTitle = () => {};
    }
    const ui = {
        Bindings: function () { this.add = () => {}; this.bind = () => calls.push(['bind']); },
        Grid,
        spinner: function () {},
    };
    const panel = { setTitle: t => calls.push(['title', t]), addToEditor: (e, t) => calls.push(['tab', t]) };
    LegacyHandler.prototype.layoutTint = () => panel;
    LegacyHandler.prototype.layoutTitle2 = () => panel;
    LegacyHandler.prototype.layoutGuideStats = () => panel;
    const Cls = load(name, {
        'legacy/LegacyHandler': LegacyHandler,
        'se/common': { Settings: { tint: v => 'hsb ' + v } },
        'se/diy': { FaceStyle: { ONE_FACE: 'one' } },
        'se/imageutils': {
            ImageUtils: { get: p => 'img ' + p, tint: (img, hsb) => img + ' ' + hsb },
        },
        'se/markup': { FIT_NONE: 'none' },
        'se/strings': { string: k => k },
        'se/ui': ui,
        ...extra,
    });
    return { Cls, calls };
}

function component(values = {}, version = 42) {
    const map = new Map(Object.entries(values));
    return {
        map,
        version,
        settings: {
            get: k => (map.has(k) ? map.get(k) : null),
            set: (k, v) => map.set(k, v),
            getRegion: k => 'region ' + k,
        },
    };
}

test('covers set their tint and portraits, and paint art under the tinted frame', () => {
    for (const [type, bottom, portraits] of [
        ['BoxCover', true, ['Portrait-Front', 'PortraitBottom-Front']],
        ['PackCover', false, ['Portrait-Front']],
    ]) {
        const { Cls, calls } = loadSubclass('legacy/CoverHandler.js');
        const h = new Cls(type, bottom);
        assert.deepEqual([...h.types], [type]);
        assert.deepEqual([...h.portraitTypes], portraits);
        const d = component();
        h.create(d);
        assert.equal(d.faceStyle, 'one');
        assert.equal(d.name, '');
        assert.equal(d.version, 42);
        assert.equal(d.map.get('tint'), '0,1,1');
        assert.deepEqual(calls.map(c => c[0]), ['attach', 'key', 'createPortraits']);

        calls.length = 0;
        h.createInterface(d, 'editor');
        assert.deepEqual(calls.filter(c => c[0] === 'tab').map(c => c[1]), [
            'Tint', 'AHLCG-General', 'AHLCG-Portraits', ...(bottom ? ['Bottom Portrait'] : []),
        ]);
        assert.deepEqual(calls.at(-1), ['bind']);

        calls.length = 0;
        h.createFrontPainter(d, 'sheet');
        h.portraits = portraits.map(p => ({ paint: () => calls.push(['portrait', p]) }));
        const painted = [];
        h.paintFront('g', d, { getRenderTarget: () => 't', paintImage: (g, img, r) => painted.push([img, r]) });
        assert.deepEqual(calls.map(c => c[0]), [
            'initBodyTags', 'clearImage', ...portraits.map(() => 'portrait'), 'drawBackTemplate', 'drawName',
        ]);
        assert.deepEqual(painted, [[
            'img ArkhamHorrorLCG/templates/AHLCG-' + type + 'Tintable.png hsb 0,1,1',
            'region AHLCG-' + type + '-Tint-region',
        ]]);

        d.map.set('tint', 'x');
        h.onClear(d);
        assert.equal(d.map.get('tint'), '0,1,1');
        calls.length = 0;
        const old = component({}, 3);
        h.onRead(old, 'ois');
        assert.deepEqual(calls.map(c => c[0]), ['attach', 'readPortraits']);
        assert.equal(old.version, 42);
    }
});

const guideDefaults = {
    PageType: 'Empty',
    Page: '1',
    RulesLeft: '',
    RulesRight: '',
    PositionPortrait1: 'TopLeftSmall',
    PositionPortrait2: 'BottomLarge',
    LineSpacingLeft: '100',
    LineSpacingRight: '100',
};

test('guides set their page defaults and lay out both columns', () => {
    const { Cls, calls } = loadSubclass('legacy/GuideHandler.js');
    const h = new Cls('GuideA4', true);
    assert.deepEqual([...h.types], ['GuideA4']);
    assert.deepEqual([...h.portraitTypes], ['Portrait1-Front', 'Portrait2-Front']);
    const d = component();
    h.create(d);
    assert.deepEqual(Object.fromEntries(d.map), guideDefaults);
    assert.equal(d.faceStyle, 'one');
    assert.equal(d.version, 42);

    calls.length = 0;
    h.createInterface(d, 'editor');
    assert.deepEqual([...calls.find(c => c[0] === 'layoutTitleGuide').at(-1)], ['p1', 'p2']);
    assert.deepEqual(calls.filter(c => c[0] === 'tab').map(c => c[1]), [
        'AHLCG-General', 'AHLCG-Portraits', 'AHLCG-Rules: AHLCG-Left', 'AHLCG-Rules: AHLCG-Right',
    ]);
    assert.deepEqual(calls.filter(c => c[0] === 'layoutText').map(c => [[...c[2]], c[3]]), [[['Rules'], 'Left'], [['Rules'], 'Right']]);
    d.map.set('Page', '9');
    h.onClear(d);
    assert.equal(d.map.get('Page'), '1');
});

test('guides paint a title or numbered page with two columns', () => {
    for (const [pageType, drawn] of [['Title', 'drawName'], ['Empty', 'drawPageNumber']]) {
        const { Cls, calls } = loadSubclass('legacy/GuideHandler.js');
        const h = new Cls('Guide75', true);
        const d = component({ ...guideDefaults, PageType: pageType, RulesLeft: 'L', RulesRight: 'R', LineSpacingRight: '120' });
        h.get = k => d.settings.get(k);
        h.key = (face, key) => 'AHLCG-' + key;
        h.createFrontPainter(d, 'sheet');
        assert.equal(h.boxes.Body.fit, 'none');
        assert.deepEqual([h.boxes.Header.style, h.boxes.Header.align], ['ResHeader', 'Header']);
        assert.deepEqual(calls.filter(c => c[0] === 'setupGuidePortrait').map(c => c.slice(2)), [
            [0, 'TopLeftSmall', false], [1, 'BottomLarge', false],
        ]);

        calls.length = 0;
        h.paintFront('g', d, 'sheet');
        assert.deepEqual(calls.map(c => c[0]), [
            'clearImage', 'drawGuideTemplate', ...(pageType === 'Title' ? ['drawName'] : []), 'drawGuidePortraits',
            ...(pageType === 'Empty' ? ['drawPageNumber'] : []), 'drawGuideBody', 'drawGuideBody',
        ]);
        assert.ok(calls.some(c => c[0] === drawn));
        assert.deepEqual(calls.filter(c => c[0] === 'drawGuideBody').map(c => c.slice(6)), [
            ['fitted region AHLCG-BodyLeft' + pageType + '-region', 'L', 100],
            ['fitted region AHLCG-BodyRight' + pageType + '-region', 'R', 120],
        ]);
    }
});

test('guides upgrade early saves only for the sizes that had them', () => {
    for (const [early, version, expected, spacing] of [
        [true, 5, 'createPortraits', '100'],
        [true, 15, 'readPortraits', '100'],
        [true, 16, 'readPortraits', 'kept'],
        [false, 5, 'readPortraits', 'kept'],
    ]) {
        const { Cls, calls } = loadSubclass('legacy/GuideHandler.js');
        const h = new Cls('GuideLetter', early);
        const d = component({ LineSpacingLeft: 'kept', LineSpacingRight: 'kept' }, version);
        h.onRead(d, 'ois');
        assert.deepEqual(calls.map(c => c[0]), ['attach', expected], `${early} ${version}`);
        assert.equal(d.map.get('LineSpacingLeft'), spacing);
        assert.equal(d.map.get('LineSpacingRight'), spacing);
        assert.equal(d.version, 42);
    }
});
