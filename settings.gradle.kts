// Bundle and render-test build for the AHLCG plug-in. Strange Eons defaults to
// ~/Projects/strange-eons; override with -PstrangeEonsDir. Pass
// -PrenderTestPluginDir or -PsePluginDir to build the render-test or bundle
// plug-in from a local checkout.
pluginManagement {
    repositories {
        gradlePluginPortal()
        mavenCentral()
    }
    providers.gradleProperty("renderTestPluginDir").orNull?.let { includeBuild(it) }
    providers.gradleProperty("sePluginDir").orNull?.let { includeBuild(it) }
}

rootProject.name = "StrangeEonsAHLCG"

// Release bundles, packaged by org.strangeeons.plugin from the plug-in folders.
include(":base", ":hd")
project(":base").projectDir = file("ArkhamHorrorLCG/ArkhamHorrorLCG")
project(":hd").projectDir = file("ArkhamHorrorLCG/ArkhamHorrorLCGHD")
