module.exports = {
  packagerConfig: {
    icon: 'src/icons/plis',
    osxSign: {
      identity: process.env.APPLE_IDENTITY,
      hardenedRuntime: true,
      entitlements: "entitlements.plist",
      'entitlements-inherit': "entitlements.plist"
    },
    osxNotarize: {
      tool: 'notarytool',
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_ID_PASSWORD,
      teamId: process.env.APPLE_TEAMID
    }
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        target: 'portable',
        setupIcon: 'src/icons/plis.ico'
      },
    },
    {
      name: '@electron-forge/maker-appx',
      config: {
        identityName: "Dept.ofHomeElectronicsKAI.PLIS",
        applicationId: "Dept.ofHomeElectronicsKAI.PLIS",
        publisherDisplayName: "Dept. of HomeElectronics, KAIT",
        publisher: 'CN=C750459E-8B61-41D7-B726-8ED587655544',
        languages: ["JA-JP", "EN-US"]
      }
    },
    {
      name: '@electron-forge/maker-dmg',
      config: {
        format: 'ULFO'
      }
    },
    {
      name: '@electron-forge/maker-deb',
      config: {
        options: {
          icon: 'src/icons/plis_linux_icon.png'
        }
      },
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {
        options: {
          icon: 'src/icons/plis_linux_icon.png'
        }
      },
    },
  ],
};
