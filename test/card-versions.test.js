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

test('the legacy library takes CARD_VERSION from handlers/CardVersion', () => {
    assert.ok(
        read('AHLCG-legacyLibrary.js').includes(
            'const CARD_VERSION = AHLCGModules.CardVersion;'
        )
    );
});

const handlers = fs
    .readdirSync(diy)
    .filter((f) => f.endsWith('.js') && !f.startsWith('AHLCG'))
    .sort();

for (const name of handlers) {
    test(`${name} takes its version from CARD_VERSION`, () => {
        const text = read(name);
        assert.doesNotMatch(text, /diy\.version\s*=\s*\d/, 'literal version');
        if (text.includes("useLibrary('amd')")) {
            assert.doesNotMatch(text, /\bversion\s*[:=]/, 'own version');
        } else {
            const sets = text.match(/diy\.version\s*=\s*CARD_VERSION/g) || [];
            assert.equal(sets.length, 2, 'CARD_VERSION set in create and onRead');
        }
    });
}
