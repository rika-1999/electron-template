export default {
  appId: 'com.example.electron-test',
  productName: 'electron-test',
  directories: {
    output: 'release',
    buildResources: 'build',
  },
  asar: false,
  files: ['dist/**/*', 'package.json', '!node_modules/**'],
  extraMetadata: {
    main: 'dist/main/index.js',
  },
  win: {
    target: [
      {
        target: 'nsis',
        arch: ['x64'],
      },
    ],
    artifactName: '${productName}-${version}-${arch}.${ext}',
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    runAfterFinish: true,
  },
  mac: {
    // Reserved - no signing/notarization in v1
    target: [
      {
        target: 'zip',
        arch: ['arm64'],
      },
    ],
    category: 'public.app-category.productivity',
    artifactName: '${productName}-${version}-${arch}.${ext}',
  },
  publish: {
    provider: 'generic',
    url: process.env.UPDATE_SERVER_URL ?? 'http://localhost:8888',
    updaterCacheDirName: 'electron-test-updater',
  },
}
