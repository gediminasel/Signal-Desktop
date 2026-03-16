{
  stdenv,
  rustPlatform,
  fetchNpmDeps,
  npmHooks,
  protobuf,
  clang,
  gitMinimal,
  cmake,
  boringssl,
  fetchFromGitHub,
  python3,
  nodejs,
}:
rustPlatform.buildRustPackage (finalAttrs: {
  pname = "libsignal-node";
  version = "0.88.1";

  src = fetchFromGitHub {
    owner = "signalapp";
    repo = "libsignal";
    tag = "v${finalAttrs.version}";
    hash = "sha256-AQGxGRQH29lxtFAE+57BZp3UmcX1ivDAdLRtJrT8lL0=";
  };

  cargoHash = "sha256-nhsazxfoa6XwNY8ZN+pFk8vrjeYYLYsixLzQ8A5O1MY=";

  npmRoot = "node";
  npmDeps = fetchNpmDeps {
    name = "${finalAttrs.pname}-npm-deps";
    inherit (finalAttrs) version src;
    sourceRoot = "${finalAttrs.src.name}/${finalAttrs.npmRoot}";
    hash = "sha256-f3wUgf6yq72tUzdUztxRJ4KEGiLPNUoKqSSPR4ny1Eo=";
  };

  nativeBuildInputs = [
    python3
    protobuf
    nodejs
    clang
    gitMinimal
    cmake
    npmHooks.npmConfigHook
    rustPlatform.bindgenHook
  ];

  env = {
    BORING_BSSL_INCLUDE_PATH = "${boringssl.dev}/include";
    BORING_BSSL_PATH = boringssl;
    NIX_LDFLAGS = if stdenv.hostPlatform.isDarwin then "-lc++" else "-lstdc++";
  };

  patches = [
    # This is used to strip absolute paths of dependencies to avoid leaking info about build machine. Nix builders
    # already solve this problem by chrooting os this is not needed.
    ./dont-strip-absolute-paths.patch
  ];
  postPatch = ''
    substituteInPlace node/build_node_bridge.py \
      --replace-fail "'prebuilds'" "'$out/lib'" \
      --replace-fail "objcopy = shutil.which('%s-linux-gnu-objcopy' % cargo_target.split('-')[0]) or 'objcopy'" \
                     "objcopy = os.getenv('OBJCOPY', 'objcopy')"
  '';

  buildPhase = ''
    runHook preBuild

    pushd node
    npm run build -- --copy-to-prebuilds --node-arch ${stdenv.hostPlatform.node.arch}
    popd

    runHook postBuild
  '';

  dontCargoInstall = true;
})