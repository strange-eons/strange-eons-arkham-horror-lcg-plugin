// The HD bundle accepts a base plug-in of the same version, as SE reports it.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const script = fs.readFileSync(
    path.join(
        __dirname,
        '../ArkhamHorrorLCG/ArkhamHorrorLCGHD/resources/ArkhamHorrorLCG/ArkhamHorrorLCGHD.js'
    ),
    'utf8'
);

const BASE_ID = '0b899f3c-78ae-40b8-bcfc-b06479b1f136';

// runs initialize() with the HD bundle at hdVersion and the base plug-in
// reporting baseVersion as a Java float
function initialize(hdVersion, baseVersion) {
    const alerts = [];
    const javaString = (s) => ({ toString: () => ({ equals: (o) => o === s }) });
    const extensions =
        baseVersion === undefined
            ? []
            : [
                  {
                      getCatalogID: () => ({ getUUID: () => javaString(BASE_ID) }),
                      getPlugin: () => ({ getPluginVersion: () => Math.fround(baseVersion) }),
                  },
              ];
    const context = {
        useLibrary() {},
        alert: (message) => alerts.push(message),
        ResourceKit: { getInputStream: () => ({ close() {} }) },
        Game: { get: () => ({ masterSettings: { addSettingsFrom() {} } }) },
        arkham: { plugins: { BundleInstaller: { getInstalledExtensions: () => extensions } } },
        java: {
            util: {
                Properties: function () {
                    this.load = () => {};
                    this.getProperty = () => String(hdVersion);
                },
            },
            lang: { Float: { parseFloat: (s) => Math.fround(parseFloat(s)) } },
        },
    };
    vm.runInNewContext(script, context);
    return { result: context.initialize(), alerts };
}

for (const minor of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]) {
    const version = Number(`10.${minor}`);
    test(`HD ${version} accepts base ${version}`, () => {
        const { result, alerts } = initialize(version, version);
        assert.deepEqual(alerts, []);
        assert.equal(result, true);
    });
}

test('HD rejects an older base', () => {
    const { result, alerts } = initialize(10.2, 10.1);
    assert.equal(result, false);
    assert.match(alerts[0], /must be 10.2 or later/);
});

test('HD accepts a newer base', () => {
    assert.equal(initialize(10.2, 10.3).result, true);
});

test('HD requires the base plug-in', () => {
    const { result, alerts } = initialize(10.2);
    assert.equal(result, false);
    assert.match(alerts[0], /plugin is mising/);
});
