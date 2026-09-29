/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { setBackgroundMessageHandler } from './src/notifications';

// Must run before registerComponent — RNFirebase requires the
// background/killed-state message handler to be registered outside the
// React component tree.
setBackgroundMessageHandler();

AppRegistry.registerComponent(appName, () => App);
