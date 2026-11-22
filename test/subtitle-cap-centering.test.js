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

const Java = { type: () => function JavaClass() {} };
const FaceUtils = load('faces/FaceUtils.js', {
    'se/common': {},
    'se/java': Java,
    'se/strings': {},
    'se/ui': {},
}, { Java });

// baseline of a line drawn with its line box centered, then shifted
function baseline(height, ascent, descent, shift) {
    return Math.max(0, (height - ascent - descent) / 2) + ascent + shift;
}

test('capShift centers the capitals in the region', () => {
    const shift = FaceUtils.capShift(21, 7.75, 10, 3);
    const top = baseline(21, 10, 3, shift) - 7.75;
    assert.ok(Math.abs(top - (21 - 7.75) / 2) < 1e-9);
});

test('capShift moves text down when descent exceeds the space above the capitals', () => {
    assert.ok(FaceUtils.capShift(21, 7, 8, 4) > 0);
});

test('capShift moves text up when the space above the capitals exceeds descent', () => {
    assert.ok(FaceUtils.capShift(21, 7, 10, 2) < 0);
});

test('capShift accounts for the top clamp of a line taller than the region', () => {
    const shift = FaceUtils.capShift(10, 7, 10, 3);
    assert.equal(baseline(10, 10, 3, shift) - 7, (10 - 7) / 2);
});

test('capShift is zero when cap height plus descent equals ascent', () => {
    assert.equal(FaceUtils.capShift(21, 7, 9, 2), 0);
});
