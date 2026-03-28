#!/usr/bin/env nix-shell
#!nix-shell -i bash -p bash nix-update common-updater-scripts curl coreutils jq gclient2nix

set -ex

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"

cd "$SCRIPT_DIR/.."

curl_github() {
  curl ${GITHUB_TOKEN:+" -u \":$GITHUB_TOKEN\""} "$@"
}

releaseEpoch=`date +%s`

packageJson="`cat $SCRIPT_DIR/../package.json`"

latestVersion="`jq -r '.version' <<< $packageJson`"
nodeVersion="`jq -r '.engines.node' <<< $packageJson | cut -d. -f1`"
electronVersion="`jq -r '.devDependencies.electron' <<< $packageJson | cut -d. -f1`"
libsignalClientVersion=`jq -r '.dependencies."@signalapp/libsignal-client"' <<< $packageJson`
signalSqlcipherVersion=`jq -r '.dependencies."@signalapp/sqlcipher"' <<< $packageJson`
ringrtcVersion=`jq -r '.dependencies."@signalapp/ringrtc"' <<< $packageJson`
ringrtcVersionProperties="`curl_github "https://raw.githubusercontent.com/signalapp/ringrtc/refs/tags/v$ringrtcVersion/config/version.properties"`"
webrtcVersion="`grep --only-matching "^webrtc.version=.*$" <<< $ringrtcVersionProperties | sed "s/webrtc.version=//g"`"

sed -E -i "s/(nodejs_)../\1$nodeVersion/" $SCRIPT_DIR/package.nix
sed -E -i "s/(electron_)../\1$electronVersion/" $SCRIPT_DIR/package.nix
sed -E -i "s/(SOURCE_DATE_EPOCH = )[0-9]+/\1$releaseEpoch/" $SCRIPT_DIR/package.nix

sed -E -i "s/(withAppleEmojis \? )false/\1true/" $SCRIPT_DIR/package.nix
# nix-update signal-desktop --subpackage sticker-creator --version="$latestVersion"
sed -E -i "s/(withAppleEmojis \? )true/\1false/" $SCRIPT_DIR/package.nix

update_nix_version() {
  local file="$1"
  local new_version="$2"
  sed -i "s|version = \"[^\"]*\";|version = \"${new_version}\";|" "$file"
}

update_nix_version "$SCRIPT_DIR/package.nix" "$latestVersion"
update_nix_version "$SCRIPT_DIR/libsignal-node.nix" "$libsignalClientVersion"
update_nix_version "$SCRIPT_DIR/ringrtc.nix" "$ringrtcVersion"
update_nix_version "$SCRIPT_DIR/signal-sqlcipher.nix" "$signalSqlcipherVersion"

bash $SCRIPT_DIR/update_hashes.sh

gclient2nix generate "https://github.com/signalapp/webrtc@$webrtcVersion" > $SCRIPT_DIR/webrtc-sources.json