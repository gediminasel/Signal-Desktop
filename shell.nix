{
  pkgs ? import <nixpkgs> { },
}:

let
in
pkgs.mkShell {
  buildInputs = with pkgs; [
    nodejs_24
    pnpm_10
    jq
    nix-update
    nix-direnv
    nixVersions.latest
    gclient2nix
  ];
}
