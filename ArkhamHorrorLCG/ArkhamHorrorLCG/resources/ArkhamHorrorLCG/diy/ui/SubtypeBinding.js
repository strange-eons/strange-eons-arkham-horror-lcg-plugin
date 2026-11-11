// A missing subtype represents a card without a weakness.
define(['se/ui'], function (ui) {
    function SubtypeBinding(name, control, component, sheets) {
        ui.ComboBoxBinding.call(this, name, control, component, sheets);
    }

    SubtypeBinding.prototype = Object.create(ui.ComboBoxBinding.prototype);
    SubtypeBinding.prototype.constructor = SubtypeBinding;

    SubtypeBinding.prototype.initComponent = function () {
        var value = this.settings.get(this.name);
        this.settingToControl(value == null ? 'None' : value, this.control);
        if (String(value) === 'None') this.settings.reset(this.name);
    };

    SubtypeBinding.prototype.update = function () {
        var value = this.controlToSetting(this.control);
        if (value == null) return false;
        if (String(value) !== 'None')
            return ui.ComboBoxBinding.prototype.update.call(this);
        if (this.settings.get(this.name) == null) return false;
        var changed = ui.ComboBoxBinding.prototype.update.call(this);
        this.settings.reset(this.name);
        return changed;
    };

    return SubtypeBinding;
});
