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

function TextBlocksFace() {}
TextBlocksFace.prototype.textRegion = () => ({ x: 0, y: 100, width: 300, height: 300 });
TextBlocksFace.prototype.key = (settings, name) => 'AHLCG-TokenRulesFace-' + name;
const Java = { type: () => function JavaClass() {} };
const TokenRulesFace = load('faces/TokenRulesFace.js', {
    'faces/FaceUtils': {},
    'faces/TextBlocks': { Styles: [] },
    'faces/TextBlocksFace': TextBlocksFace,
    'se/markup': {},
    'se/strings': {},
    'se/ui': {},
    'se/java': Java,
}, { Java });

// 10 units per character; words wrap at the region width and a word wider
// than the region overflows onto a second line. Each line is 20 high.
const WIDTH = 120;
function box() {
    return {
        markupText: '',
        measure() {
            const plain = this.markupText.replace(/<[^>]*>/g, '');
            const words = plain.split(' ');
            let lines = 1;
            let used = 0;
            for (const word of words) {
                const w = word.length * 10;
                if (used > 0 && used + 10 + w > WIDTH) { lines++; used = w; }
                else used += (used > 0 ? 10 : 0) + w;
            }
            if (used > WIDTH) lines++;
            return lines * 20;
        },
    };
}
const card = {
    settings: {
        get: () => null,
        getRegion: () => ({ x: 0, y: 0, width: WIDTH, height: 75 }),
    },
};
const face = new TokenRulesFace();
const wrap = title => face.wrapTitle({}, card, box(), title);

test('wrapTitle keeps a title that fits on one line', () => {
    assert.equal(wrap('Short one'), 'Short one');
});

test('wrapTitle keeps a title the user already broke', () => {
    assert.equal(wrap('A very long\ntitle that overflows'), 'A very long\ntitle that overflows');
});

test('wrapTitle breaks a long title at the space nearest the middle', () => {
    assert.equal(wrap('Alpha Beta Gamma Delta'), 'Alpha Beta\nGamma Delta');
});

test('wrapTitle breaks at the middle space when no break fits', () => {
    assert.equal(wrap('Aaaaaaa Bbbbbbb Ccccccc Ddddddd'), 'Aaaaaaa Bbbbbbb\nCcccccc Ddddddd');
});

test('wrapTitle tries farther spaces when the middle one does not fit', () => {
    // tags move the middle by characters toward the space that leaves
    // "Aaaa Bbbbbbbbb" (140) on the first line
    assert.equal(wrap('Aaaa Bbbbbbbbb <size 50%>Cc<size 200%>'), 'Aaaa\nBbbbbbbbb <size 50%>Cc<size 200%>');
});

test('wrapTitle ignores spaces inside markup tags', () => {
    assert.equal(wrap('<size 80%>Wordsxx<size 125%> wordsxxx'), '<size 80%>Wordsxx<size 125%>\nwordsxxx');
});

test('wrapTitle keeps a long title with no spaces', () => {
    assert.equal(wrap('Abcdefghijklmnop'), 'Abcdefghijklmnop');
});

test('textRegion counts the painted title lines', () => {
    const settings = { get: () => null };
    const c = { settings };
    face.isFullPage = () => false;
    face.getTitle = () => 'One line';
    face.getDifficulty = () => 'None';
    assert.equal(face.textRegion(c, 0, 'Body').y, 100);
    face.paintedTitle = 'Two\nlines';
    assert.equal(face.textRegion(c, 0, 'Body').y, 124);
    face.paintedTitle = null;
});
