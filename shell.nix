{
  pkgs ? import <nixpkgs> { },
}:

let
in
pkgs.mkShell {
  buildInputs = [
    pkgs.nodejs_24
    pkgs.pnpm_10
  ];
}
