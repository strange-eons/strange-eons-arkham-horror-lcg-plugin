// Strange Eons ui library: layouts, controls and bindings.
//
// Module: returns { Bindings, Grid, button, buttonGroup, checkBox, comboBox,
// portraitPanel, radioButton, spinner, textArea, textField, tintPanel,
// tipButton, toggleButton }.
/* global
  useLibrary, Bindings, ComboBoxBinding, Grid, button, buttonGroup, checkBox, comboBox,
  portraitPanel, radioButton, spinner, textArea, textField, tintPanel, tipButton,
  toggleButton
 */
useLibrary('ui');

define(function () {
    return {
        Bindings: Bindings,
        ComboBoxBinding: ComboBoxBinding,
        Grid: Grid,
        button: button,
        buttonGroup: buttonGroup,
        checkBox: checkBox,
        comboBox: comboBox,
        portraitPanel: portraitPanel,
        radioButton: radioButton,
        spinner: spinner,
        textArea: textArea,
        textField: textField,
        tintPanel: tintPanel,
        tipButton: tipButton,
        toggleButton: toggleButton,
    };
});
