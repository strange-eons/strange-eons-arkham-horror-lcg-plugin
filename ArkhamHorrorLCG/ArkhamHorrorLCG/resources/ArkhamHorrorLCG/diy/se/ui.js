// Strange Eons ui library: layouts, controls and bindings.
//
// Module: returns { Bindings, Grid, button, checkBox, comboBox, portraitPanel, spinner,
// textArea, textField, tintPanel, tipButton, toggleButton }.
/* global
  useLibrary, Bindings, ComboBoxBinding, Grid, button, checkBox, comboBox, portraitPanel,
  spinner, textArea, textField, tintPanel, tipButton, toggleButton
 */
useLibrary('ui');

define(function () {
    return {
        Bindings: Bindings,
        ComboBoxBinding: ComboBoxBinding,
        Grid: Grid,
        button: button,
        checkBox: checkBox,
        comboBox: comboBox,
        portraitPanel: portraitPanel,
        spinner: spinner,
        textArea: textArea,
        textField: textField,
        tintPanel: tintPanel,
        tipButton: tipButton,
        toggleButton: toggleButton,
    };
});
