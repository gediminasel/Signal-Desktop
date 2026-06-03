{
  pkgs ? import <nixpkgs> { },
}:

let
  stdenv = pkgs.stdenv;
  lib = pkgs.lib;
  nodejs = pkgs.nodejs_24;
  pnpm = pkgs.pnpm_10;
  electron = pkgs.electron_42;

  libsignal-node = pkgs.callPackage ./libsignal-node.nix { inherit nodejs; };
  signal-sqlcipher = pkgs.callPackage ./signal-sqlcipher.nix { inherit pnpm nodejs; };
  webrtc = pkgs.callPackage ./webrtc.nix { };
  ringrtc = pkgs.callPackage ./ringrtc.nix { inherit webrtc; };
in
pkgs.mkShell {
  name = "signal-desktop-dev-shell";

  # Mirror the build-time environment variables
  env = {
    ELECTRON_SKIP_BINARY_DOWNLOAD = "1";
    ELECTRON_FORCE_IS_PACKAGED = "1";
    # SIGNAL_ENV = "development";
    SIGNAL_ENV = "production";
    npm_config_nodedir = "${electron.headers}";
  } // pkgs.lib.optionalAttrs pkgs.stdenv.hostPlatform.isDarwin {
    CSC_IDENTITY_AUTO_DISCOVERY = "false";
  };

  buildInputs = with pkgs; [
    nodejs
    pnpm
    electron

    jq
    nix-update
    nix-direnv
    nixVersions.latest
    gclient2nix
    pnpmConfigHook
    makeWrapper
    python3
    node-gyp
  ];

  # Automatically hook into the local working copy when entering the shell
  shellHook = ''
    echo "⚡ Welcome to the Signal Desktop dev shell ⚡"
    echo "Electron headers pinned to: $npm_config_nodedir"

    # 1. Ensure node_modules exists before trying to link custom prebuilds
    if [ ! -d "node_modules" ]; then
      echo "⚠️ 'node_modules' not found. Fetching store and installing..."
      pnpm install --frozen-lockfile=true
    fi

    echo "🔗 Linking custom Nix native components..."

    if [ ! -d "node_modules/@signalapp/ringrtc/build/linux" ]; then
      mkdir -p node_modules/@signalapp/ringrtc/build/linux
    fi
    cp -f ${ringrtc}/lib/libringrtc${stdenv.hostPlatform.extensions.library} \
      node_modules/@signalapp/ringrtc/build/linux/libringrtc-x64.node

    rm -f node_modules/@signalapp/sqlcipher
    ln -s ${signal-sqlcipher} node_modules/@signalapp/sqlcipher

    echo 'pnpm run generate'
    echo '${lib.getExe electron} .'
  '';
}
