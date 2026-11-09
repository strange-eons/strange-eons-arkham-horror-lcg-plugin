import org.strangeeons.gradle.rendertest.BuildStrangeEons
import org.strangeeons.gradle.rendertest.PackagePluginFolder
import org.strangeeons.gradle.rendertest.RenderComponents
import org.strangeeons.gradle.rendertest.UpdateRenderMasters
import org.strangeeons.gradle.rendertest.VerifyRenders

plugins {
    id("org.strangeeons.render-test") version "1.0.1"
    id("net.researchgate.release") version "3.2.0"
    id("org.strangeeons.plugin") version "1.0.0" apply false
}

val projects = "${System.getProperty("user.home")}/Projects"

strangeEonsRenderTest {
    strangeEonsDir = file(providers.gradleProperty("strangeEonsDir").getOrElse("$projects/strange-eons"))
    pluginFolder = file("ArkhamHorrorLCG/ArkhamHorrorLCG")
    pluginBundleName = "ArkhamHorrorLCG.seext"
    // -PcomponentsDir renders another fixture set against the same masters
    components = file(providers.gradleProperty("componentsDir").getOrElse("src/renderTest/components"))
    // high-res templates; catches sub-pixel layout shifts
    resolution = 300
}

release {
    preTagCommitMessage = "chore: release"
    newVersionCommitMessage = "chore: start"
    git {
        // Review the release commits and tag, then push with --follow-tags.
        pushToRemote = false
    }
}

// SE plug-in versions are floats: 10.0.0-SNAPSHOT is 10.0. Minors are one
// digit so that 10.10 can't read as 10.1.
fun seVersion(version: String): String {
    val m = Regex("""(\d+)\.(\d)\.\d+(-SNAPSHOT)?""").matchEntire(version)
        ?: throw GradleException("Version $version is not major.minor.patch[-SNAPSHOT] with a one-digit minor")
    return "${m.groupValues[1]}.${m.groupValues[2]}"
}

// The plug-in scripts read their version from these files.
fun writePluginVersion(name: String, file: String) = tasks.register<WriteProperties>(name) {
    description = "Writes the plug-in version for the scripts to read."
    destinationFile = file(file)
    property("version", project.version.toString())
    property("se-version", seVersion(project.version.toString()))
}

val baseVersionFile = "ArkhamHorrorLCG/ArkhamHorrorLCG/resources/ArkhamHorrorLCG/version.properties"
val hdVersionFile = "ArkhamHorrorLCG/ArkhamHorrorLCGHD/resources/ArkhamHorrorLCG/version-hd.properties"
val writeBaseVersion = writePluginVersion("writeBaseVersion", baseVersionFile)
val writeHdVersion = writePluginVersion("writeHdVersion", hdVersionFile)

// Render tests only; release bundles come from the :base and :hd projects.
tasks.named("packagePluginFolder") { dependsOn(writeBaseVersion) }

// Each plug-in folder is its project's only resource directory, packed as
// Strange Eons' Make Bundle would, with a freshly stamped catalog ID.
fun Project.pluginBundle(bundle: String, writeVersion: TaskProvider<*>) {
    apply(plugin = "org.strangeeons.plugin")
    layout.buildDirectory = rootProject.layout.buildDirectory.dir("plugins/$name")
    configure<org.strangeeons.gradle.plugin.StrangeEonsPluginExtension> {
        bundleName = bundle
        bundleType = "seext"
        rootFile = layout.projectDirectory.file("eons-plugin")
    }
    the<SourceSetContainer>()["main"].resources {
        setSrcDirs(listOf(projectDir))
        exclude("seproject", "**/*.ts.js", "**/.*", "**/.*/**")
    }
    tasks.named("processResources") { dependsOn(writeVersion) }
}

project(":base") { pluginBundle("ArkhamHorrorLCG", writeBaseVersion) }
project(":hd") { pluginBundle("ArkhamHorrorLCGHD", writeHdVersion) }

// Release bundles; does not need Strange Eons or the src/renderTest submodule.
val bundles by tasks.registering(Sync::class) {
    group = "build"
    description = "Collects the plug-in bundles into build/dist."
    from(project(":base").tasks.named("sePlugin"))
    from(project(":hd").tasks.named("sePlugin"))
    into(layout.buildDirectory.dir("dist"))
}

tasks.named("assemble") { dependsOn(bundles) }

val verifyPluginVersions by tasks.registering {
    group = "verification"
    description = "Checks version parsing and each bundle's version file, catalog ID and contents."
    val dist = bundles.map { it.destinationDir }
    val version = project.version.toString()
    val pack = tasks.named<PackagePluginFolder>("packagePluginFolder").flatMap { it.bundle }
    val rootFiles = mapOf(
        "ArkhamHorrorLCG.seext" to file("ArkhamHorrorLCG/ArkhamHorrorLCG/eons-plugin"),
        "ArkhamHorrorLCGHD.seext" to file("ArkhamHorrorLCG/ArkhamHorrorLCGHD/eons-plugin"),
    )
    inputs.files(bundles, pack)
    inputs.files(rootFiles.values)
    doLast {
        // entries of a bundle, skipping SE's 4-byte web-safe header if present
        fun <T> readBundle(bundle: File, read: (java.util.zip.ZipInputStream) -> T): T {
            val bytes = bundle.readBytes()
            // SE strips the header from bundles it loads, so render tests
            // leave the base bundle without one
            val start = if (bytes[0] == 0x07.toByte() && bytes[1] == 0x88.toByte()) 4 else 0
            return java.util.zip.ZipInputStream(bytes.inputStream(start, bytes.size - start)).use(read)
        }

        fun fileNames(bundle: File) = readBundle(bundle) { zip ->
            generateSequence { zip.nextEntry }.filter { !it.isDirectory }.map { it.name }
                .filter { !it.startsWith("META-INF/") }.toSortedSet()
        }

        // UUID to date fields of each catalog ID
        val catalogId = Regex("""CATALOGU?E?ID\{([-\da-fA-F]+):([\d-]+)}""", RegexOption.IGNORE_CASE)
        fun catalogIds(text: String) = catalogId.findAll(text)
            .map { it.groupValues[1].lowercase() to it.groupValues[2].split('-').map(String::toInt) }.toList()

        fun newer(a: List<Int>, b: List<Int>) =
            a.zip(b).firstOrNull { (x, y) -> x != y }?.let { (x, y) -> x > y } ?: false

        val files = fileNames(pack.get().asFile)
        val shipped = fileNames(dist.get().resolve("ArkhamHorrorLCG.seext"))
        check(shipped == files) {
            "ArkhamHorrorLCG.seext differs from the render-test bundle: only shipped ${shipped - files}, " +
                "only tested ${files - shipped}"
        }

        rootFiles.forEach { (bundle, source) ->
            val text = readBundle(dist.get().resolve(bundle)) { zip ->
                generateSequence { zip.nextEntry }.firstOrNull { it.name == "eons-plugin" }
                    ?: throw GradleException("$bundle has no eons-plugin")
                String(zip.readBytes(), Charsets.ISO_8859_1)
            }
            val before = catalogIds(source.readText(Charsets.ISO_8859_1))
            val after = catalogIds(text)
            check(before.isNotEmpty()) { "$source has no catalog ID" }
            check(after.map { it.first } == before.map { it.first }) { "$bundle catalog UUIDs changed" }
            before.zip(after).forEach { (b, a) ->
                check(newer(a.second, b.second)) { "$bundle catalog ID ${a.second} is not newer than ${b.second}" }
            }
        }

        mapOf("10.0.0" to "10.0", "10.1.0-SNAPSHOT" to "10.1", "9.9.12" to "9.9").forEach { (v, se) ->
            check(seVersion(v) == se) { "seVersion($v) is ${seVersion(v)}, expected $se" }
        }
        listOf("10.0", "10.10.0", "10.0.0-rc1", "v10.0.0").forEach { v ->
            check(runCatching { seVersion(v) }.isFailure) { "seVersion($v) should fail" }
        }
        val expected = mapOf("version" to version, "se-version" to seVersion(version))
        mapOf(
            "ArkhamHorrorLCG.seext" to "resources/ArkhamHorrorLCG/version.properties",
            "ArkhamHorrorLCGHD.seext" to "resources/ArkhamHorrorLCG/version-hd.properties",
        ).forEach { (bundle, entry) ->
            val actual = readBundle(dist.get().resolve(bundle)) { zip ->
                generateSequence { zip.nextEntry }.firstOrNull { it.name == entry }
                    ?: throw GradleException("$bundle has no $entry")
                java.util.Properties().apply { load(zip) }.toMap()
            }
            check(actual == expected) { "$bundle $entry is $actual, expected $expected" }
        }
    }
}

tasks.named("check") { dependsOn(verifyPluginVersions) }

val fixtureScript = file("src/renderTest/generate-fixtures.js")
val amdScript = file("src/renderTest/amd-loader.js")

// Fixtures, masters and test scripts live in the src/renderTest submodule.
val checkRenderTestSources by tasks.registering {
    description = "Fails if the src/renderTest submodule is not checked out."
    val script = fixtureScript
    doLast {
        if (!script.isFile) {
            throw GradleException("src/renderTest is not checked out. Run: git submodule update --init src/renderTest")
        }
    }
}

// Copies output to the console and to a log.
class TeeOutputStream(private val console: java.io.OutputStream, private val log: java.io.OutputStream) :
    java.io.OutputStream() {
    override fun write(b: Int) {
        console.write(b)
        log.write(b)
    }

    override fun write(b: ByteArray, off: Int, len: Int) {
        console.write(b, off, len)
        log.write(b, off, len)
    }

    override fun flush() {
        console.flush()
        log.flush()
    }

    override fun close() = log.close()
}

// Runs the fixture script in Strange Eons with the packaged plug-in. Script
// errors that Strange Eons reports and recovers from fail the task.
fun Exec.runFixtureScript(mode: String, out: File, work: File, overwrite: Boolean = false, flexibleOut: File = out) {
    val buildSe = tasks.named<BuildStrangeEons>("buildStrangeEons")
    val pack = tasks.named<PackagePluginFolder>("packagePluginFolder")
    dependsOn(buildSe, pack)
    val launcher = strangeEonsRenderTest.launcher
    isIgnoreExitValue = true
    doFirst {
        work.deleteRecursively()
        val user = work.resolve("user").apply { mkdirs() }
        user.resolve("preferences").writeText("")
        val lib = buildSe.get().installDir.get().asFile.resolve("lib")
        val cp = lib.listFiles { f -> f.name.endsWith(".jar") }!!.sorted().joinToString(File.pathSeparator)
        environment("STRANGE_EONS_USER_DIR", user.absolutePath)
        val log = java.io.FileOutputStream(work.resolve("output.txt"))
        standardOutput = TeeOutputStream(System.out, log)
        errorOutput = TeeOutputStream(System.err, log)
        commandLine(
            launcher.get().executablePath.asFile.absolutePath,
            "--add-opens=java.desktop/javax.swing.table=ALL-UNNAMED",
            "--enable-native-access=ALL-UNNAMED",
            "-Dfx.mode=$mode",
            "-Dfx.out=${out.absolutePath}",
            "-Dfx.flexibleOut=${flexibleOut.absolutePath}",
            "-Dfx.results=${work.resolve("results.txt").absolutePath}",
            "-Dfx.overwrite=$overwrite",
            "-Dfx.amdScript=${amdScript.absolutePath}",
            "-Dfx.version=${seVersion(project.version.toString())}",
            "-cp", cp,
            "ca.cgjennings.apps.arkham.StrangeEons",
            "--xDisableJreCheck", "--xDisablePluginLoading",
            "--glang", "en", "--ulang", "en",
            "--plugintest", pack.get().bundle.get().asFile.absolutePath,
            "--run", fixtureScript.absolutePath,
        )
    }
    doLast {
        standardOutput.close()
        val results = work.resolve("results.txt")
        if (!results.exists() || results.readLines().lastOrNull() != "DONE") {
            throw GradleException("Fixture script stopped early. See $results")
        }
        val failed = results.readLines().filter { it.startsWith("FAIL") }
        failed.forEach { logger.error(it) }
        if (failed.isNotEmpty()) throw GradleException("${failed.size} handler(s) failed. See $results")
        val output = work.resolve("output.txt")
        val uncaught = output.readLines().count { it.startsWith("Uncaught ") }
        if (uncaught > 0) throw GradleException("$uncaught uncaught script error(s). See $output")
    }
}

// Card handlers share CARD_VERSION.
val verifyCardVersions by tasks.registering {
    group = "verification"
    description = "Checks that card handlers share CARD_VERSION."
    val diy = file("ArkhamHorrorLCG/ArkhamHorrorLCG/resources/ArkhamHorrorLCG/diy")
    inputs.dir(diy)
    doLast {
        // face handlers (AMD modules) and the legacy library take the version from handlers/CardVersion
        val module = diy.resolve("handlers/CardVersion.js").readText()
        val current = Regex("""return (\d+);""").find(module)?.groupValues?.get(1)?.toInt()
            ?: throw GradleException("handlers/CardVersion.js returns no version")
        val problems = mutableListOf<String>()
        val legacy = diy.resolve("AHLCG-legacyLibrary.js").readText()
        if (!legacy.contains("const CARD_VERSION = AHLCGModules.CardVersion;")) {
            problems += "AHLCG-legacyLibrary.js does not take CARD_VERSION from handlers/CardVersion"
        }
        diy.listFiles { f -> f.name.endsWith(".js") && !f.name.startsWith("AHLCG") }!!.sorted().forEach { f ->
            val text = f.readText()
            if (Regex("""diy\.version\s*=\s*\d""").containsMatchIn(text)) problems += "${f.name} sets a literal version"
            if (text.contains("useLibrary('amd')")) {
                if (Regex("""\bversion\s*[:=]""").containsMatchIn(text)) problems += "${f.name} sets its own version"
            } else if (Regex("""diy\.version\s*=\s*CARD_VERSION""").findAll(text).count() != 2) {
                problems += "${f.name} does not set CARD_VERSION in create and onRead"
            }
        }
        if (problems.isNotEmpty()) throw GradleException(problems.joinToString("\n"))
        logger.lifecycle("CARD_VERSION $current")
    }
}

tasks.named("check") { dependsOn(verifyCardVersions) }

// Script errors that Strange Eons reports and recovers from while rendering
// fail the render.
tasks.withType<RenderComponents>().configureEach {
    doLast {
        val log = workDir.get().asFile.resolve("strange-eons.log")
        val uncaught = if (log.exists()) log.readLines().count { it.startsWith("Uncaught ") } else 0
        if (uncaught > 0) throw GradleException("$uncaught uncaught script error(s). See $log")
    }
}

// Writes .eon fixtures with the current plug-in. Existing fixtures are kept
// unless -PoverwriteFixtures is set, since they also guard save compatibility.
// -PfixturesDir writes them elsewhere, as components/ and flexible/.
val generateFixtures by tasks.registering(Exec::class) {
    group = "render test"
    description = "Creates the render-test .eon fixtures with Strange Eons."
    val root = providers.gradleProperty("fixturesDir").map { file(it) }.getOrElse(file("src/renderTest"))
    runFixtureScript(
        "fixtures",
        root.resolve("components"),
        layout.buildDirectory.dir("render-test/fixtures").get().asFile,
        providers.gradleProperty("overwriteFixtures").isPresent,
        root.resolve("flexible"),
    )
}

// Flexible card fixtures have one face on both sides and render both. A back
// is checked against its front's master, with the collector line's side
// suffix masked; a filled back, against its own master, so the back's
// collector line is checked too.
val flexiblePlatform = tasks.named<VerifyRenders>("verifyRenders").flatMap { it.platform }

// The collection number's a/b suffix, and the icon it moves, in pixels of
// each face's renders, or of a face/variant's where it moves; faces without a
// collector line have none.
val flexibleSuffixMasks = mapOf(
    "enemy" to java.awt.Rectangle(670, 1018, 50, 26),
    "story" to java.awt.Rectangle(570, 974, 46, 26),
    "tokenRules" to java.awt.Rectangle(670, 1018, 50, 26),
    "treachery" to java.awt.Rectangle(670, 1018, 50, 26),
    "treacheryLocation" to java.awt.Rectangle(670, 1018, 50, 26),
    "asset" to java.awt.Rectangle(670, 1018, 50, 26),
    "event" to java.awt.Rectangle(630, 1012, 90, 34),
    "skill" to java.awt.Rectangle(670, 1018, 50, 26),
    "location" to java.awt.Rectangle(670, 1018, 50, 26),
    "enemyLocation" to java.awt.Rectangle(670, 1018, 50, 26),
    "key" to java.awt.Rectangle(670, 1026, 50, 26),
    "investigator" to java.awt.Rectangle(995, 715, 45, 22),
    "act" to java.awt.Rectangle(570, 718, 45, 22),
    "act/reversed" to java.awt.Rectangle(988, 718, 45, 22),
    "act/reversedReturnTo" to java.awt.Rectangle(988, 718, 45, 22),
    "agenda" to java.awt.Rectangle(982, 718, 45, 22),
    "agendaFrontPortrait" to java.awt.Rectangle(982, 708, 45, 22),
    "agendaPortrait" to java.awt.Rectangle(982, 718, 45, 22),
    "agenda/reversed" to java.awt.Rectangle(564, 718, 45, 22),
    "agenda/reversedReturnTo" to java.awt.Rectangle(564, 718, 45, 22),
    "agenda/reversedPerInvestigator" to java.awt.Rectangle(564, 718, 45, 22),
)

// A back has its own master when filled, or when its face draws backs
// differently.
object FlexibleBacks {
    private val distinctBacks = setOf("key")

    fun isBack(path: String) = path.endsWith("-1.png")

    fun hasMaster(path: String) =
        path.endsWith("/filled-1.png") || path.split('/').dropLast(1).lastOrNull() in distinctBacks
}

// Copies renders and masters for VerifyRenders: each back without a master of
// its own, and its front's master in its place, with the suffix masked.
abstract class StageFlexibleRenders : DefaultTask() {
    @get:InputDirectory abstract val actual: DirectoryProperty
    @get:InputFiles abstract val platformMasters: DirectoryProperty
    @get:Input abstract val masks: MapProperty<String, java.awt.Rectangle>
    @get:OutputDirectory abstract val stagedActual: DirectoryProperty
    @get:OutputDirectory abstract val stagedMasters: DirectoryProperty

    private fun masked(source: File, target: File, mask: java.awt.Rectangle?) {
        target.parentFile.mkdirs()
        if (mask == null) {
            source.copyTo(target, overwrite = true)
            return
        }
        val image = javax.imageio.ImageIO.read(source)
        val g = image.createGraphics()
        g.color = java.awt.Color.MAGENTA
        g.fill(mask)
        g.dispose()
        javax.imageio.ImageIO.write(image, "png", target)
    }

    @TaskAction
    fun stage() {
        val actualDir = actual.get().asFile
        val mastersDir = platformMasters.get().asFile
        val outActual = stagedActual.get().asFile.apply { deleteRecursively(); mkdirs() }
        val outMasters = stagedMasters.get().asFile.apply { deleteRecursively(); mkdirs() }

        if (mastersDir.isDirectory) mastersDir.copyRecursively(outMasters)
        actualDir.walk().filter { it.isFile && it.name.endsWith(".png") }.forEach { render ->
            val path = render.relativeTo(actualDir).invariantSeparatorsPath
            val target = outActual.resolve(path)
            if (!FlexibleBacks.isBack(path) || FlexibleBacks.hasMaster(path)) {
                render.copyTo(target, overwrite = true)
                return@forEach
            }
            val face = path.substringAfter("components/").substringBefore('/')
            val variant = path.substringAfterLast('/').removeSuffix("-1.png")
            val mask = masks.get()["$face/$variant"] ?: masks.get()[face]
            masked(render, target, mask)
            val front = mastersDir.resolve(path.removeSuffix("-1.png") + "-0.png")
            if (front.isFile) masked(front, outMasters.resolve(path), mask)
        }
    }
}

// The renders that are recorded as masters: fronts and filled backs.
fun Sync.flexibleMastersFrom(renders: Provider<Directory>) {
    from(renders) {
        include("**/*.png")
        exclude { FlexibleBacks.isBack(it.relativePath.pathString) && !FlexibleBacks.hasMaster(it.relativePath.pathString) }
    }
}

// Registers render, verify and update tasks for one set of flexible card
// renders; configure adjusts the renderer.
fun registerFlexibleRenders(
    name: String,
    title: String,
    mode: String,
    mastersDir: String,
    verifyTask: String,
    updateTask: String,
    configure: RenderComponents.() -> Unit,
) {
    val outDir = "render-test/flexible$name"
    val render = tasks.register<RenderComponents>("renderFlexible$title") {
        group = "render test"
        description = "Renders both sides of the flexible card fixtures$mode."
        val defaults = tasks.named<RenderComponents>("renderComponents").get()
        applicationClasspath.from(defaults.applicationClasspath)
        bundles.from(defaults.bundles)
        components = file(providers.gradleProperty("flexibleDir").getOrElse("src/renderTest/flexible"))
        resolution = strangeEonsRenderTest.resolution
        gameLanguage = strangeEonsRenderTest.gameLanguage
        uiLanguage = strangeEonsRenderTest.uiLanguage
        jvmArgs = strangeEonsRenderTest.jvmArgs
        userSettings = strangeEonsRenderTest.userSettings
        renderBacks = true
        launcher = strangeEonsRenderTest.launcher
        outputDir = layout.buildDirectory.dir("$outDir/actual")
        workDir = layout.buildDirectory.dir("$outDir/work")
        configure()
    }
    val platformMasters = layout.projectDirectory.dir(flexiblePlatform.map { "$mastersDir/$it" })
    val stage = tasks.register<StageFlexibleRenders>("stageFlexible${title}Renders") {
        actual = render.flatMap { it.outputDir }
        this.platformMasters = platformMasters
        masks = flexibleSuffixMasks
        stagedActual = layout.buildDirectory.dir("$outDir/staged/actual")
        stagedMasters = layout.buildDirectory.dir("$outDir/staged/masters")
    }
    tasks.register<VerifyRenders>(verifyTask) {
        group = "render test"
        description = "Fails if any flexible card render$mode differs from this platform's masters."
        actual = stage.flatMap { it.stagedActual }
        mastersRoot = file(mastersDir)
        this.platformMasters = stage.flatMap { it.stagedMasters }
        platform = flexiblePlatform
        javaVendor = strangeEonsRenderTest.launcher.map { it.metadata.vendor }
        javaRuntimeVersion = strangeEonsRenderTest.launcher.map { it.metadata.javaRuntimeVersion }
        diffs = layout.buildDirectory.dir("$outDir/diffs")
    }
    val recorded = tasks.register<Sync>("selectFlexible${title}Masters") {
        flexibleMastersFrom(render.flatMap { it.outputDir })
        into(layout.buildDirectory.dir("$outDir/recorded"))
    }
    tasks.register<UpdateRenderMasters>(updateTask) {
        group = "render test"
        description = "Replaces this platform's flexible card masters$mode with the fronts and filled backs."
        dependsOn(recorded)
        actual = layout.buildDirectory.dir("$outDir/recorded")
        this.platformMasters = platformMasters
        platform = flexiblePlatform
        javaVendor = strangeEonsRenderTest.launcher.map { it.metadata.vendor }
        javaRuntimeVersion = strangeEonsRenderTest.launcher.map { it.metadata.javaRuntimeVersion }
    }
}

registerFlexibleRenders(
    "", "", "", "src/renderTest/flexible-masters", "verifyFlexibleRenders", "updateFlexibleRenderMasters",
) {}
// Ink saver draws no images, so it shows what a face paints over the white sheet.
registerFlexibleRenders(
    "-ink-saver", "InkSaver", " in ink saver mode", "src/renderTest/flexible-ink-saver-masters",
    "verifyFlexibleInkSaver", "updateFlexibleInkSaverMasters",
) {
    userSettings.put("render-as-prototype", "yes")
}

val defaultsDump = layout.buildDirectory.dir("render-test/defaults/actual")
val defaultsExpected = file("src/renderTest/defaults")

val dumpDefaults by tasks.registering(Exec::class) {
    group = "render test"
    description = "Lists the state of a newly created component for each card handler."
    inputs.dir(strangeEonsRenderTest.pluginFolder)
    inputs.file(fixtureScript)
    inputs.file(amdScript)
    inputs.dir("src/renderTest/amd")
    outputs.dir(defaultsDump)
    // stale files would show up as handlers with no expected file
    doFirst { defaultsDump.get().asFile.deleteRecursively() }
    runFixtureScript("defaults", defaultsDump.get().asFile, layout.buildDirectory.dir("render-test/defaults/work").get().asFile)
}

val verifyDefaults by tasks.registering {
    group = "verification"
    description = "Compares new-component state for each card handler with src/renderTest/defaults."
    dependsOn(dumpDefaults)
    inputs.dir(defaultsDump)
    inputs.dir(defaultsExpected)
    doLast {
        val actual = defaultsDump.get().asFile
        val names = sortedSetOf<String>().apply {
            actual.list()?.let { addAll(it) }
            defaultsExpected.list()?.let { addAll(it) }
        }
        val failures = names.mapNotNull { name ->
            val a = actual.resolve(name)
            val e = defaultsExpected.resolve(name)
            when {
                !e.exists() -> "$name: no expected file"
                !a.exists() -> "$name: not produced"
                else -> {
                    val al = a.readLines().toSet()
                    val el = e.readLines().toSet()
                    val diff = (el - al).map { "- $it" } + (al - el).map { "+ $it" }
                    if (diff.isEmpty()) null else "$name:\n  " + diff.joinToString("\n  ")
                }
            }
        }
        if (failures.isNotEmpty()) {
            throw GradleException("${failures.size} file(s) differ:\n" + failures.joinToString("\n"))
        }
        logger.lifecycle("${names.size} file(s) match")
    }
}

val updateDefaults by tasks.registering(Copy::class) {
    group = "render test"
    description = "Replaces src/renderTest/defaults with the current new-component state."
    dependsOn(dumpDefaults)
    from(defaultsDump)
    into(defaultsExpected)
}

tasks.named("check") { dependsOn(verifyDefaults, "verifyFlexibleRenders", "verifyFlexibleInkSaver") }

listOf(
    RenderComponents::class, VerifyRenders::class, UpdateRenderMasters::class, StageFlexibleRenders::class,
).forEach { type -> tasks.withType(type).configureEach { dependsOn(checkRenderTestSources) } }
listOf(generateFixtures, dumpDefaults, verifyDefaults, updateDefaults).forEach {
    it.configure { dependsOn(checkRenderTestSources) }
}
