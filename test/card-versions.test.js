// Card handlers share CARD_VERSION, from handlers/CardVersion.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const diy = path.join(
    __dirname,
    '../ArkhamHorrorLCG/ArkhamHorrorLCG/resources/ArkhamHorrorLCG/diy'
);
const read = (name) => fs.readFileSync(path.join(diy, name), 'utf8');

test('handlers/CardVersion returns the version', () => {
    assert.match(read('handlers/CardVersion.js'), /return \d+;/);
});

test('LegacyHandler takes CARD_VERSION from handlers/CardVersion', () => {
    assert.ok(
        read('legacy/LegacyHandler.js').includes(
            'LegacyHandler.CARD_VERSION = CardVersion;'
        )
    );
});

const handlers = fs
    .readdirSync(diy)
    .filter((f) => f.endsWith('.js'))
    .sort()
    .concat(['legacy/CoverHandler.js', 'legacy/GuideHandler.js']);

for (const name of handlers) {
    test(`${name} takes its version from CARD_VERSION`, () => {
        const text = read(name);
        assert.doesNotMatch(text, /diy\.version\s*=\s*\d/, 'literal version');
        const legacy = text.match(/diy\.version = LegacyHandler\.CARD_VERSION/g) || [];
        assert.ok(legacy.length === 0 || legacy.length === 2, 'set in create and onRead');
        assert.doesNotMatch(
            text.replace(/diy\.version = LegacyHandler\.CARD_VERSION/g, ''),
            /\bversion\s*[:=]/,
            'own version'
        );
    });
}
