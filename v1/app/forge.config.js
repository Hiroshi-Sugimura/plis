module.exports = {
  packagerConfig: {
    icon: './src/icons/plis',
    osxSign: {
      identity: process.env.APPLE_IDENTITY,
      hardenedRuntime: true,
      entitlements: "macOS/entitlements.plist",
      "entitlements-inherit": "macOS/entitlements.plist"
    },
    osxNotarize: {
      tool: 'notarytool',
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_ID_PASSWORD,
      teamId: process.env.APPLE_TEAMID
    },
	 extraResources: [
	    "./appx/vcruntime140.dll"
	]
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        target: 'portable',
        setupIcon: 'src/icons/plis.ico'
      }
    },
    {
      name: '@electron-forge/maker-appx',
      config: {
        applicationId: "Dept.ofHomeElectronicsKAI.PLIS",
        displayName: "PLIS",
        identityName: "Dept.ofHomeElectronicsKAI.PLIS",
        publisher: process.env.PLISPublisher,
        publisherDisplayName: "神奈川工科大学",
        languages: ["JA-JP"],
        assets: "appx/assets",
        Square150x150Logo: "appx/assets/PLIS.150x150.png",
        makeVersionWinStoreCompatible: "true",
        packageDescription: "Platform for Life Improvement and Support",
        manifest: "appx/appxmanifest.xml"
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
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'github-user-name',
          name: 'github-repo-name'
        },
        prerelease: false,
        draft: true
      }
    }
  ]
};
