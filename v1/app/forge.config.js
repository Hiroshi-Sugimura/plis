module.exports = {
  packagerConfig: {
    icon: 'src/icons/plis'
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
