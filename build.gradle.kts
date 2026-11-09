import org.strangeeons.gradle.plugin.StrangeEonsPluginExtension
import org.strangeeons.gradle.rendertest.RenderSet
import org.strangeeons.gradle.rendertest.RunScript
import org.strangeeons.gradle.rendertest.StrangeEonsTask

plugins {
    id("org.strangeeons.render-test") version "2.0.0"
    id("net.researchgate.release") version "3.2.0"
    id("org.strangeeons.plugin") version "1.1.1" apply false
}

release {
    preTagCommitMessage = "chore: release"
    newVersionCommitMessage = "chore: start"
    git {
        // Review the release commits and tag, then push with --follow-tags.
        pushToRemote = false
    }
}

// The plug-in bundles; the scripts read their version from versionProperties.
fun Project.pluginBundle(bundle: String, versionFile: String) {
    apply(plugin = "org.strangeeons.plugin")
    layout.buildDirectory = rootProject.layout.buildDirectory.dir("plugins/$name")
    configure<StrangeEonsPluginExtension> {
        bundleName = bundle
        bundleType = "seext"
        pluginFolder = layout.projectDirectory
        versionProperties = "resources/ArkhamHorrorLCG/$versionFile"
        catalogTimestampFromCommit = true
    }
}

project(":base") { pluginBundle("ArkhamHorrorLCG", "version.properties") }
project(":hd") { pluginBundle("ArkhamHorrorLCGHD", "version-hd.properties") }

val baseBundle = project(":base").tasks.named("sePlugin")

// Release bundles; does not need Strange Eons or the src/renderTest submodule.
val bundles = tasks.register<Sync>("bundles") {
    group = "build"
    description = "Collects the plug-in bundles into build/dist."
    from(baseBundle)
    from(project(":hd").tasks.named("sePlugin"))
    into(layout.buildDirectory.dir("dist"))
}

tasks.named("assemble") { dependsOn(bundles) }

val projects = "${System.getProperty("user.home")}/Projects"

// Fixtures, masters and test scripts live in the src/renderTest submodule.
val renderTest = layout.projectDirectory.dir("src/renderTest")
val fixtureScript = renderTest.file("generate-fixtures.js")
val amdScript = renderTest.file("amd-loader.js")

// Renders with the release bundle.
strangeEonsRenderTest {
    strangeEonsDir = file(providers.gradleProperty("strangeEonsDir").getOrElse("$projects/strange-eons"))
    bundles.from(baseBundle)
    // -PcomponentsDir renders another fixture set against the same masters
    components = file(providers.gradleProperty("componentsDir").getOrElse("src/renderTest/components"))
    // high-res templates; catches sub-pixel layout shifts
    resolution = 300
    // more processes add little beyond four
    forks = 4

    // Flexible card fixtures have one face on both sides. A back is checked
    // against its front's master with the collector line's a/b suffix, and the
    // icon it moves, masked; filled and key backs have masters of their own.
    val flexible = providers.gradleProperty("flexibleDir").map { file(it) }.getOrElse(file("src/renderTest/flexible"))
    fun RenderSet.flexible(masterDir: String) {
        components = flexible
        masters = renderTest.dir(masterDir)
        sharedMasters {
            renderSuffix = "-1.png"
            masterSuffix = "-0.png"
            excludes.addAll("**/filled-1.png", "components/key/*")
            for (variant in listOf("reversed", "reversedReturnTo")) mask("components/act/$variant-1.png", 988, 718, 45, 22)
            for (variant in listOf("reversed", "reversedReturnTo", "reversedPerInvestigator")) {
                mask("components/agenda/$variant-1.png", 564, 718, 45, 22)
            }
            for (face in listOf("enemy", "tokenRules", "treachery", "treacheryLocation", "asset", "skill", "location", "enemyLocation")) {
                mask("components/$face/*", 670, 1018, 50, 26)
            }
            mask("components/story/*", 570, 974, 46, 26)
            mask("components/event/*", 630, 1012, 90, 34)
            mask("components/investigator/*", 995, 715, 45, 22)
            mask("components/act/*", 570, 718, 45, 22)
            mask("components/agenda/*", 982, 718, 45, 22)
            mask("components/agendaFrontPortrait/*", 982, 708, 45, 22)
            mask("components/agendaPortrait/*", 982, 718, 45, 22)
        }
    }
    renderSets.register("flexible") { flexible("flexible-masters") }
    // Ink saver draws no images, so it shows what a face paints over the white sheet.
    renderSets.register("flexibleInkSaver") {
        flexible("flexible-ink-saver-masters")
        userSettings.put("render-as-prototype", "yes")
    }

    // The state of a newly created component for each card handler.
    textChecks.register("defaults") {
        script = fixtureScript
        scriptInputs.from(amdScript, renderTest.dir("amd"))
        systemProperties.putAll(mapOf("fx.mode" to "defaults", "fx.amdScript" to amdScript.asFile.path))
        masters = renderTest.dir("defaults")
        ignoreLineOrder = true
    }
}

// Writes .eon fixtures with the current plug-in. Existing fixtures are kept
// unless -PoverwriteFixtures is set, since they also guard save compatibility.
// -PfixturesDir writes them elsewhere, as components/ and flexible/.
tasks.register<RunScript>("generateFixtures") {
    group = "render test"
    description = "Creates the render-test .eon fixtures with Strange Eons."
    val root = providers.gradleProperty("fixturesDir").map { file(it) }.getOrElse(renderTest.asFile)
    script = fixtureScript
    scriptInputs.from(amdScript)
    systemProperties.putAll(mapOf(
        "fx.mode" to "fixtures",
        "fx.out" to root.resolve("components").path,
        "fx.flexibleOut" to root.resolve("flexible").path,
        "fx.overwrite" to providers.gradleProperty("overwriteFixtures").isPresent.toString(),
        "fx.amdScript" to amdScript.asFile.path,
    ))
}

tasks.withType<StrangeEonsTask>().configureEach {
    doFirst {
        if (!fixtureScript.asFile.isFile) {
            throw GradleException("src/renderTest is not checked out. Run: git submodule update --init src/renderTest")
        }
    }
}
