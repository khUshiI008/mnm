import React from 'react';
import { Picker as RNPicker, PickerProps } from '@react-native-picker/picker';
import { colors } from '../theme';

/**
 * Thin wrapper around @react-native-picker/picker's Picker. Every screen in
 * this app renders its own light-themed card/surface regardless of the
 * device's OS light/dark setting — but the bare Picker doesn't set an
 * explicit text color unless told to, so it falls back to following the
 * DEVICE's own dark-mode text color. On some Android devices/skins (reported
 * on a Samsung Galaxy Z Fold in dark mode) that resolves to a color that's
 * invisible against this app's always-light picker background: the control
 * still works — tapping it opens the native option list fine, and selecting
 * an option updates the value fine — but the closed-state field showing the
 * current selection renders blank. Forcing an explicit color/background here
 * (once, centrally) makes every picker in the app render identically
 * regardless of the device's OS theme, instead of fixing this per-screen.
 */
function AppPickerImpl<T>(props: PickerProps<T>) {
  const { style, ...rest } = props;
  return <RNPicker<T> dropdownIconColor={colors.text} {...rest} style={[styles.picker, style]} />;
}

const styles = { picker: { color: colors.text, backgroundColor: 'transparent' } };

// Every call site uses <Picker.Item ...> — this type carries that static
// through so it type-checks the same as the real Picker did. TS can't infer
// "generic function + static property" from a plain assignment, so the type
// is declared explicitly and the runtime static is attached via a cast.
type PickerWithItem = (<T>(props: PickerProps<T>) => React.ReactElement) & { Item: typeof RNPicker.Item };

const AppPicker = AppPickerImpl as PickerWithItem;
AppPicker.Item = RNPicker.Item;

export const Picker = AppPicker;
export default AppPicker;
