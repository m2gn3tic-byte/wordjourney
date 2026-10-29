#!/usr/bin/env bash
set -euo pipefail
PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"
export JAVA_HOME="${JAVA_HOME:-/workspace/android-jdk}"
export ANDROID_HOME="${ANDROID_HOME:-/workspace/android-sdk}"
export ANDROID_USER_HOME="${ANDROID_USER_HOME:-/workspace/android-user}"
export GRADLE_USER_HOME="${GRADLE_USER_HOME:-/workspace/android-gradle}"
test -x "$JAVA_HOME/bin/javac" || { printf '%s\n' 'Install a full JDK 21 with npm run android:setup.' >&2; exit 1; }
test -f "$ANDROID_HOME/platforms/android-36/android.jar" || { printf '%s\n' 'Android SDK 36 is required. Run npm run android:setup.' >&2; exit 1; }
npm run build
npx --no-install cap sync android
mapfile -t proxy_args < <(node scripts/java-proxy-args.mjs)
(
  cd android
  ./gradlew --no-daemon --max-workers=2 "${proxy_args[@]}" --console=plain assembleDebug bundleRelease :app:lintDebug
)
mkdir -p artifacts
cp android/app/build/outputs/apk/debug/app-debug.apk artifacts/sonarannak-debug.apk
cp android/app/build/outputs/bundle/release/app-release.aab artifacts/sonarannak-unsigned.aab
"$ANDROID_HOME/build-tools/36.0.0/apksigner" verify --verbose artifacts/sonarannak-debug.apk
"$ANDROID_HOME/build-tools/36.0.0/aapt" dump badging artifacts/sonarannak-debug.apk > artifacts/android-badging.txt
sed -n '1,8p' artifacts/android-badging.txt
sha256sum artifacts/sonarannak-debug.apk artifacts/sonarannak-unsigned.aab > artifacts/android-sha256.txt
printf '%s\n' 'Debug APK verified. Release AAB is unsigned and requires the owner’s upload key before Play submission.'
