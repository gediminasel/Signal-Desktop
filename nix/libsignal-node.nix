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
let
  boringsslStatic = boringssl.overrideAttrs (old: {
    cmakeFlags = (old.cmakeFlags or [ ]) ++ [ "-DBUILD_SHARED_LIBS=OFF" ];
  });
in
rustPlatform.buildRustPackage (finalAttrs: {
  pname = "libsignal-node";
  version = "0.93.2";

  src = fetchFromGitHub {
    owner = "signalapp";
    repo = "libsignal";
    tag = "v${finalAttrs.version}";
    hash = "sha256-U32vd5TzgA1LwlFgLUJU30gUeQoYnKI7kYnhy+d8eQk=";
  };

  cargoHash = "sha256-5thq1MXL792u87fv6M5E1oi8gq6S8dnTsy3k26T7pgM=";

  npmRoot = "node";
  npmDeps = fetchNpmDeps {
    name = "${finalAttrs.pname}-npm-deps";
    inherit (finalAttrs) version src;
    sourceRoot = "${finalAttrs.src.name}/${finalAttrs.npmRoot}";
    hash = "sha256-Ui69OTkcICU+qdIuSB0NIwQtsDY2mSj57NhAxx9t87o=";
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
    BORING_BSSL_INCLUDE_PATH = "${boringsslStatic.dev}/include";
    BORING_BSSL_PATH = boringsslStatic;
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