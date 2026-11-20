// Follows projects as they open: a project without a layout choice gets one
// (see ProjectDefaults).
//
// Module: returns { register, opened }.
define(['core/ProjectDefaults', 'se/common', 'se/java'], function (
    ProjectDefaults,
    common,
    java
) {
    function opened(project) {
        ProjectDefaults.initialize(project);
    }

    function guard(f) {
        return function (project) {
            try {
                f(project);
            } catch (ex) {
                Error.handleUncaught(ex);
            }
        };
    }

    // once per application, after start up, when the window exists; a
    // project open by then counts as opened
    function register() {
        var Eons = java.type('ca.cgjennings.apps.arkham.StrangeEons');
        var named = common.Eons.namedObjects;
        if (named.AHLCGProjectEvents != null) return;
        var listener = java.extend(
            'ca.cgjennings.apps.arkham.StrangeEonsAppWindow$ProjectEventListener',
            { projectOpened: guard(opened), projectClosing: function () {} }
        );
        named.AHLCGProjectEvents = listener;
        Eons.getApplication().addStartupTask(
            java.extend('java.lang.Runnable', {
                run: function () {
                    var window = Eons.getWindow();
                    if (window == null) return;
                    window.addProjectEventListener(listener);
                    var project = Eons.getOpenProject();
                    if (project != null) guard(opened)(project);
                },
                toString: function () {
                    return 'AHLCG project events';
                },
            })
        );
    }

    return { register: register, opened: opened };
});
