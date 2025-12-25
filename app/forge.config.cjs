//////////////////////////////////////////////////////////////////////
/**
 * @file forge.config.cjs
 * @module forge.config
 * @description Electron Forge configuration for PLIS application.
 * Configures build targets, packaging, signing, notarization, and security settings
 * for Windows (Squirrel, APPX), macOS (DMG, ZIP), and Linux (DEB, RPM) platforms.
 * Includes Electron Fuses configuration for enhanced security.
 */
//////////////////////////////////////////////////////////////////////

const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');
const path = require('path');
const fs = require('fs');

module.exports = {
  /**
   * Packager configuration for application distribution.
   * Enables code signing and notarization for macOS,
   * and sets up app icons for all platforms.
   * @type {Object}
   */
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
      appleApiKey: process.env.APPLE_API_KEY,
      appleApiKeyId: process.env.APPLE_API_KEY_ID,
      appleApiIssuer: process.env.APPLE_API_ISSUER
    }
  },
  /**
   * Rebuild configuration for native modules.
   * @type {Object}
   */
  rebuildConfig: {},
  /**
   * Makers configuration array for packaging application binaries.
   * Supports multiple platforms: Windows (Squirrel, APPX),
   * macOS (ZIP, DMG), and Linux (DEB, RPM).
   * @type {Array<Object>}
   */
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
      name: '@electron-forge/maker-dmg',
      config: {
        background: './assets/dmg-background.png',
        background: '',
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
  /**
   * Publishers configuration array for distributing releases.
   * Currently configured for GitHub releases publishing.
   * @type {Array<Object>}
   */
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
  /**
   * Plugins configuration array for Electron Forge.
   * Includes auto-unpack natives and Electron Fuses for security.
   * @type {Array<Object>}
   */
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    // =============================================================================
    // Electron Fuses 利用理由と各オプションの意味（将来メンテ用メモ）
    // -----------------------------------------------------------------------------
    // この new FusesPlugin(...) は配布バイナリに対し “ヒューズ” (実行時に変更不能な
    // セキュリティ/挙動フラグ) を焼き込んで攻撃面積を減らすために使ってる。
    // ここで false/true を設定しておくことで、
    //   ・環境変数経由の Node 任意挙動注入
    //   ・RunAsNode の悪用
    //   ・packaged アプリの外側から改ざんされたコード読ませる
    // などを防ぐ。
    //
    // 今は plugin-fuses@7.10.2 が peer で @electron/fuses ^1.x を要求しているため
    // @electron/fuses 2.x にはまだ上げていない（上げると ERESOLVE になる）。
    // v2 対応に切り替えたいときは:
    //   1. plugin-fuses の新バージョンが 2.x を peer で許容しているかリリースノート確認
    //   2. 許容されていれば package.json の overrides を外し両方アップデート
    //   3. forge make / notarize が通るか検証
    // 自前で plugin を外して直接 flipFuses() を呼ぶ力技もあるが、署名フェーズ順序管理が面倒なので現状は公式プラグイン維持。
    //
    // 各 FuseV1Options の意味:
    //   RunAsNode: false
    //     → Electron 本体を node の代替として悪用する起動モード禁止（任意コード実行の踏み台抑止）
    //   EnableCookieEncryption: true
    //     → Chromium Cookie を OS の暗号化機構利用で保護（平文窃取リスク低減）
    //   EnableNodeOptionsEnvironmentVariable: false
    //     → NODE_OPTIONS 環境変数経由のインジェクションを封じる（--require 等の悪用防止）
    //   EnableNodeCliInspectArguments: false
    //     → --inspect / --inspect-brk 等デバッグポート露出を禁止（本番でのリモート侵入防止）
    //   EnableEmbeddedAsarIntegrityValidation: true
    //     → asar の整合性検証を有効化し、差し替え改ざんを検出
    //   OnlyLoadAppFromAsar: true
    //     → asar 以外の外部ファイルからアプリコード読ませない（設置型コード差し替え封じ）
    //
    // これらを変えたいときは「本当に必要な機能か」「攻撃面積にどんな影響か」を README か
    // CHANGELOG に残してから変更すること。
    // =============================================================================
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,                          // RunAsNodeモード無効化
      [FuseV1Options.EnableCookieEncryption]: true,              // Cookie暗号化有効
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false, // NODE_OPTIONS無効
      [FuseV1Options.EnableNodeCliInspectArguments]: false,      // --inspect 等禁止
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true, // asar整合性検証
      [FuseV1Options.OnlyLoadAppFromAsar]: true,                 // asar以外ロード禁止
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
