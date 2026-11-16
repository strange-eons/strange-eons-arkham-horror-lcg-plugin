useLibrary( 'extension' );
function getName() {
	return 'Arkham Horror LCG HD templates';
}
function getDescription() {
	return 'HD templates for the Arkham Horror LCG plugin';
}
var seVersion;
// the build's version as SE compares it: 10.0.0-SNAPSHOT is 10.0
function getVersion() {
	if (seVersion === undefined) {
		var props = new java.util.Properties();
		var input = ResourceKit.getInputStream('ArkhamHorrorLCG/version-hd.properties');
		try {
			props.load(input);
		} finally {
			input.close();
		}
		seVersion = parseFloat(String(props.getProperty('se-version')));
	}
	return seVersion;
}

function initialize() {
    var game = Game.get('AHLCG');
    if (game == null) {
        alert("[Arkham Horror LCG HD] Cannot find registered game, Arkham Horror LCG plugin is mising", true);
        return false;
    }

    let found = false;
    for (let ext of arkham.plugins.BundleInstaller.getInstalledExtensions()) {
        if (ext.getCatalogID().getUUID().toString().equals("0b899f3c-78ae-40b8-bcfc-b06479b1f136")) {
            // SE reports plug-in versions as floats; 10.2 as a float is less than 10.2
            if (ext.getPlugin().getPluginVersion() < java.lang.Float.parseFloat(String(getVersion()))) {
                alert("[Arkham Horror LCG HD] Arkham Horror LCG plugin version must be " + getVersion() + " or later", true);
                return false;
            }
            found = true;
            break;
        }
    }

    if (!found) {
        alert("[Arkham Horror LCG HD] Arkham Horror LCG plugin is mising", true);
        return false;
    }

    game.masterSettings.addSettingsFrom('ArkhamHorrorLCG/hd/AHLCG-HD.settings');
    return true;
}

function unload() {
}
