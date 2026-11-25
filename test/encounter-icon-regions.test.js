const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const dir = path.join(__dirname, '../ArkhamHorrorLCG/ArkhamHorrorLCG/resources/ArkhamHorrorLCG/settings/faces');

// <prefix>: { icon, ret } regions as [x, y, w, h], prefix being the key up to
// EncounterIcon-region
function regions() {
    const found = {};
    for (const file of fs.readdirSync(dir)) {
        for (const line of fs.readFileSync(path.join(dir, file), 'utf8').split('\n')) {
            const m = /^(AHLCG-\w+Face-(?:[\w]+-)?)(Return)?EncounterIcon-region = (.*)$/.exec(line);
            if (m == null) continue;
            (found[m[1]] ??= {})[m[2] ? 'ret' : 'icon'] = m[3].split(',').map(Number);
        }
    }
    return found;
}

// faces whose return disc is drawn as a circle as wide as its region, over
// the face's own disc, with the icon cut out at its EncounterIcon region
const FILLED = /^AHLCG-(Enemy|Location|LocationBack|Treachery|TreacheryLocation)Face-/;
// faces that draw their set icon on the card's art, not on a disc
const NO_DISC = /^AHLCG-TokenRulesFace-/;
// the farthest any set icon reaches from its center, as a share of the
// square it fits in
const WORST_REACH = 0.704;

// A return-to disc covers the face's disc: its center is the disc's, and
// a set icon fit to its region stays clear of the disc's edge.
for (const [prefix, { icon, ret }] of Object.entries(regions())) {
    if (icon == null || ret == null) continue;
    test(`${prefix}EncounterIcon-region is centered on its disc, clear of the edge`, () => {
        const [x, y, size, height] = icon;
        assert.equal(size, height, 'square');
        for (const v of icon) assert.equal(v * 4, Math.round(v * 4), 'quarter steps');
        const [rx, ry, rw, rh] = ret;
        const filled = FILLED.test(prefix);
        const center = [rx + rw / 2, ry + (filled ? rw : rh) / 2];
        assert.ok(Math.abs(x + size / 2 - center[0]) <= 0.5, `x center ${x + size / 2} vs ${center[0]}`);
        assert.ok(Math.abs(y + size / 2 - center[1]) <= 0.5, `y center ${y + size / 2} vs ${center[1]}`);
        if (!filled && !NO_DISC.test(prefix)) assert.ok(WORST_REACH * size <= rw / 2 - 1.5, `${size} in a ${rw} disc`);
    });
}
