const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const resources = path.join(__dirname, '../ArkhamHorrorLCG/ArkhamHorrorLCG/resources/ArkhamHorrorLCG');
const diy = path.join(resources, 'diy');
function load(name, modules, globals = {}) {
    let result;
    vm.runInNewContext(fs.readFileSync(path.join(diy, name), 'utf8'), {
        ...globals,
        define(deps, factory) { result = factory(...deps.map(name => modules[name])); },
    }, { filename: path.join(diy, name) });
    return result;
}

function settingsFile(name) {
    const values = {};
    for (const line of fs.readFileSync(path.join(resources, 'settings/faces', name), 'utf8').split('\n')) {
        const match = /^([^#=\s][^=]*?)\s*=\s*(.*)$/.exec(line);
        if (match) values[match[1]] = match[2];
    }
    return values;
}

function CardFace() {}
CardFace.prototype.key = function (settings, name) {
    return this.template + '-' + name;
};
const drawn = [];
const FaceUtils = {
    plugin: () => ({ subtitleFontOffset: '0' }),
    drawCapCentered(g, box, text, region) { drawn.push({ text, region }); },
};
const PlayerCard = { initial: name => ({ Seeker: 'K', Neutral: 'N' })[name] };
const Java = { type: () => function JavaClass() {} };
const InvestigatorFace = load('faces/InvestigatorFace.js', {
    'faces/CardFace': CardFace,
    'faces/FaceUtils': FaceUtils,
    'faces/PlayerCard': PlayerCard,
    'faces/PortraitArt': {},
    'se/java': Java,
    'se/strings': {},
    'se/ui': {},
});

function region(value) {
    const [x, y, width, height] = value.split(',').map(Number);
    return { x, y, width, height };
}

test('paintClassSubtitle keeps a fractional subtitle region', () => {
    drawn.length = 0;
    const values = { 'AHLCG-InvestigatorFace-SubtitleTextK-region': '297,41.5,155,11' };
    const settings = {
        getRegion: () => assert.fail('subtitle region read as whole pixels'),
        getRegion2D: key => region(values[key]),
    };
    InvestigatorFace.prototype.paintClassSubtitle(null, { settings }, 'box', 'Seeker', 'The Wonder Worker');
    assert.deepEqual(drawn, [{ text: 'The Wonder Worker', region: { x: 297, y: 41.5, width: 155, height: 11 } }]);
});

test('a story investigator back centers its subtitle as neutral art does', () => {
    const values = settingsFile('InvestigatorBackFace.settings');
    assert.equal(
        values['AHLCG-InvestigatorBackFace-SubtitleTextS-region'],
        values['AHLCG-InvestigatorBackFace-SubtitleTextN-region']
    );
});

test('investigator back subtitles sit above the front subtitles', () => {
    const front = settingsFile('InvestigatorFace.settings');
    const back = settingsFile('InvestigatorBackFace.settings');
    for (const initial of ['G', 'K', 'R', 'M', 'V', 'N']) {
        for (const suffix of ['', 'P']) {
            const name = 'SubtitleText' + initial + suffix + '-region';
            const f = region(front['AHLCG-InvestigatorFace-' + name]);
            const b = region(back['AHLCG-InvestigatorBackFace-' + name]);
            assert.ok(b.y < f.y, name);
        }
    }
});
