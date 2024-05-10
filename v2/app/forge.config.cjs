const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');
const path = require('path');
const fs = require('fs');

module.exports = {
  packagerConfig: {
    asar: true,
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
        applicationId: "Dept.ofHomeElectronicsKAI.PLIS",
        displayName: "PLIS",
        identityName: "Dept.ofHomeElectronicsKAI.PLIS",
        publisher: "CN=C750459E-8B61-41D7-B726-8ED587655544",
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
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
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
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
  hooks: {
    postPackage: async (config, packageResult) => {
      if (packageResult.platform == 'win32') {
        let src = path.join(__dirname, 'appx', 'vcruntime140.dll');
        let dst = path.join(__dirname, 'out', 'PLIS-win32-x64', 'vcruntime140.dll');
        fs.copyFileSync(src, dst);
      }
    }
  }
};
