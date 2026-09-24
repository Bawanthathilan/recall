/**
 * iOS 27 requires the scene-based app life cycle: an app built with Xcode 27
 * that still creates its window in the AppDelegate is stopped at launch
 * (`_UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption`).
 *
 * Expo SDK 57 ships the scene delegate (`ExpoAppSceneDelegate`), but its
 * prebuild template doesn't use it yet. This config plugin switches it on
 * whenever the ios/ folder is generated:
 *  1. Info.plist: register ExpoAppSceneDelegate as the scene delegate.
 *  2. AppDelegate: hand its React Native factory to the scene delegate
 *     (ExpoReactNativeFactoryProvider) instead of creating the window itself.
 *
 * Remove this once Expo's template adopts scenes (check after upgrading the SDK).
 */
const { withAppDelegate, withInfoPlist } = require('expo/config-plugins');

function withSceneManifest(config) {
  return withInfoPlist(config, (c) => {
    c.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            // @objc name of expo's ExpoAppSceneDelegate, so no Swift file is needed.
            UISceneDelegateClassName: 'EXExpoAppSceneDelegate',
          },
        ],
      },
    };
    return c;
  });
}

function withSceneAppDelegate(config) {
  return withAppDelegate(config, (c) => {
    if (c.modResults.language !== 'swift') throw new Error('withSceneLifecycle expects a Swift AppDelegate');
    let src = c.modResults.contents;
    if (src.includes('ExpoReactNativeFactoryProvider')) return c; // already applied

    const classLine = 'class AppDelegate: ExpoAppDelegate {';
    const windowBlock = /\n#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\n\s*factory\.startReactNative\([\s\S]*?\)\n#endif\n/;
    if (!src.includes(classLine) || !windowBlock.test(src)) {
      throw new Error('withSceneLifecycle: the AppDelegate template changed — check whether Expo now adopts scenes itself.');
    }
    src = src.replace(classLine, 'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {');
    src = src.replace(windowBlock, '\n    // The window and React Native start in ExpoAppSceneDelegate (see plugins/withSceneLifecycle.js).\n');
    c.modResults.contents = src;
    return c;
  });
}

module.exports = function withSceneLifecycle(config) {
  return withSceneAppDelegate(withSceneManifest(config));
};
