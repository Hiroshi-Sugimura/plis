# SwitchBot オフラインデバイスのグレーアウト表示 実装計画書

ネットワークから外れた（オフライン状態の）SwitchBotデバイスをダッシュボード上でわかりやすくグレーアウトし、かつ操作できないようにするための実装計画を以下に示します。

---

## User Review Required

> [!IMPORTANT]
> - **オフライン判定基準**:
>   - SwitchBotのステータスデータ（`devState`）が取得できなかった（`undefined` または `null`）デバイスを「オフライン」と判定します。
> - **UIへの反映 (グレーアウト)**:
>   - オフライン判定されたデバイスの表示カード（`<section class="dev">`）にCSSフィルタ `filter: grayscale(100%); opacity: 0.5;` および `pointer-events: none;`（操作の無効化）を適用します。
>   - デバイス名の横に赤字で `(オフライン)` と警告テキストを表示します。
> - **プロパティアクセスの堅牢化（クラッシュ対策）**:
>   - デバイスがオフラインの場合、`devState.power` や `devState.temperature` などの未定義プロパティへのアクセスでJavaScriptエラー（描画停止）が発生するのを防ぐため、ダミーのステータスオブジェクトを動的に割り当てて安全に描画を継続させます。

---

## Open Questions

特になし。

---

## Proposed Changes

### 1. フロントエンド（UI・カード描画）の改修

#### [MODIFY] [subSwitchBot.js](file:///Users/sugimura/Documents/plis/app/src/public/js/subSwitchBot.js)
- `window.renewFacilitiesSwitchBot` 内のデバイスループ（65行目付近〜）にて、以下のオフラインガードを追加します：
  ```javascript
  let devState = facilitiesSwitchBot[d.deviceId];
  let isOffline = !devState || isObjEmpty(devState);

  // オフライン時のクラッシュ防止用ダミーステータス設定
  if (isOffline) {
      devState = {
          power: 'off',
          slidePosition: 0,
          battery: 0,
          temperature: '--',
          humidity: '--',
          doorState: 'unknown',
          brightness: 'dim',
          moveDetected: 'no',
          openState: 'unknown',
          voltage: 0,
          electricCurrent: 0,
          weight: 0,
          electricityOfDay: 0,
          color: '0:0:0',
          colorTemperature: 0,
          lackWater: false
      };
  }
  ```
- カードの外枠にインラインスタイルまたはオフライン専用スタイルを付与します：
  ```javascript
  let offlineStyle = isOffline ? " style='opacity: 0.5; filter: grayscale(100%); pointer-events: none;'" : "";
  doc += `<div class='LinearLayoutChild'> <section class='dev'${offlineStyle}>`;
  ```
- デバイス名表示の隣に `(オフライン)` のテキストを追加します：
  ```javascript
  let offlineText = isOffline ? " <span style='color:red; font-size:0.8em; font-weight:bold;'>(オフライン)</span>" : "";
  // switch文内の各 `${d.deviceName}` 表示部分を `${d.deviceName}${offlineText}` に置き換えます。
  ```

---

## Verification Plan

### Automated Tests
- なし

### Manual Verification
- **起動と表示検証**:
  - `npm run mac` でPLISを起動。
  - SwitchBotデバイス一覧にステータスが未取得（または意図的にオフライン）のデバイスがある場合、該当デバイスのカード全体が薄くグレーになり、ボタンがクリックできなくなっていることを確認。
  - デバイス名の横に赤字で `(オフライン)` が表示されていることを確認。
  - オンライン状態の正常なデバイスは、通常通り鮮明に表示され、クリック等の操作ができることを確認。
