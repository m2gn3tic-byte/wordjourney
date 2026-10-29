#!/usr/bin/env bash
set -euo pipefail
PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
export JAVA_HOME="${JAVA_HOME:-/workspace/android-jdk}"
export ANDROID_HOME="${ANDROID_HOME:-/workspace/android-sdk}"
export ANDROID_USER_HOME="${ANDROID_USER_HOME:-/workspace/android-user}"
if [[ -x "$JAVA_HOME/bin/javac" && -f "$ANDROID_HOME/platforms/android-36/android.jar" && -x "$ANDROID_HOME/build-tools/36.0.0/apksigner" ]]; then
  printf '%s\n' 'JDK and Android SDK 36 are already installed.'
  exit 0
fi
if [[ "$(uname -sm)" != 'Linux x86_64' ]]; then
  printf '%s\n' 'Install JDK 21 and Android SDK 36 for this platform, then set JAVA_HOME and ANDROID_HOME.' >&2
  exit 1
fi
TASK_DOWNLOAD="$(mktemp -d /tmp/wordjourney-android-XXXXXX)"
trap 'rm -rf -- "$TASK_DOWNLOAD"' EXIT
mkdir -p "$JAVA_HOME" "$ANDROID_HOME/cmdline-tools" "$ANDROID_USER_HOME"
if [[ ! -x "$JAVA_HOME/bin/javac" ]]; then
  curl --fail --silent --show-error --location 'https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.13%2B9/OpenJDK21U-jdk_x64_linux_hotspot_21.0.13_9.tar.gz' --output "$TASK_DOWNLOAD/jdk.tar.gz"
  # Official Adoptium release SHA-256, verified on 2026-10-29.
  printf '%s\n' 'd7f5d5cf865a2902b70ff549b97586a7d3f234e016f041ab447ea740c7d66d1c  jdk.tar.gz' > "$TASK_DOWNLOAD/jdk.sha256"
  (cd "$TASK_DOWNLOAD" && sha256sum --check jdk.sha256)
  tar -xzf "$TASK_DOWNLOAD/jdk.tar.gz" --strip-components=1 -C "$JAVA_HOME"
fi
if [[ ! -x "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" ]]; then
  curl --fail --silent --show-error --location 'https://dl.google.com/android/repository/commandlinetools-linux-16111833_latest.zip' --output "$TASK_DOWNLOAD/tools.zip"
  # SHA-1 published in Google's official repository2-3.xml manifest.
  printf '%s\n' 'e025545c62a8e64c7559119566a569fb1dec5f60  tools.zip' > "$TASK_DOWNLOAD/tools.sha1"
  (cd "$TASK_DOWNLOAD" && sha1sum --check tools.sha1)
  unzip -q "$TASK_DOWNLOAD/tools.zip" -d "$TASK_DOWNLOAD/tools"
  mv "$TASK_DOWNLOAD/tools/cmdline-tools" "$ANDROID_HOME/cmdline-tools/latest"
fi
mapfile -t proxy_args < <(node "$PROJECT_ROOT/scripts/java-proxy-args.mjs")
export JAVA_OPTS="${JAVA_OPTS:-} ${proxy_args[*]}"
SDK_MANAGER="$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager"
set +o pipefail
yes | "$SDK_MANAGER" --sdk_root="$ANDROID_HOME" --licenses
license_status=$?
set -o pipefail
if [[ "$license_status" -ne 0 ]]; then exit "$license_status"; fi
"$SDK_MANAGER" --sdk_root="$ANDROID_HOME" 'platform-tools' 'platforms;android-36' 'build-tools;36.0.0'
test -f "$ANDROID_HOME/platforms/android-36/android.jar"
test -x "$ANDROID_HOME/build-tools/36.0.0/apksigner"
"$JAVA_HOME/bin/javac" -version
