//////////////////////////////////////////////////////////////////////
//	Copyright (C) Hiroshi SUGIMURA 2013.09.27.
//	Last updated: 2022.08.24
//////////////////////////////////////////////////////////////////////
/**
 * @namespace window
 * @desc index.js
 */

/**
 * @namespace window.ipc
 * @desc index.js
 */
'use strict'

////////////////////////////////////////////////////////////////////////////////
/**
 * @Func isObjEmpty
 * @Desc 内部
 * @Param {Void}
 * @Return {Void}
 */
function isObjEmpty(obj) {
	return Object.keys(obj).length === 0;
}


////////////////////////////////////////////////////////////////////////////////
window.addEventListener('load', onLoad);

/**
 * @Func window.onLoad
 * @Desc ドキュメントがロードされたら呼ばれる
 * HTMLがロードされたら実行，EventListenerとしてはDOMContentLoadedのあとloadする。
 * このシステムとしてはindex.jsが最後実行してほしいのでloadとし、
 * 他のサブモジュールをDOMContentLoadedにする
 * @Param {Void}
 * @Return {Void}
 */
function onLoad() {
	console.log('## onLoad index.js');

	// 内部変数
	let licenses;      // 使用モジュールのライセンス
	let halData;       // HALのデータ

	// ライセンス
	let divLicenses = document.getElementById('divLicenses'); // ライセンス表記

	// debug
	let myIPaddr = document.getElementById('myIPaddr');
	let txtErrLog = document.getElementById('txtErrLog');

	let syncBtn = document.getElementById('syncBtn');

	// 検索ダイアログ
	const searchBox = document.getElementById('searchBox');
	const searchInput = document.getElementById('searchInput');
	const searchResult = document.getElementById('searchResult');

	//////////////////////////////////////////////////////////////////
	/**
	 * @event
	 * @name window.ipc.to-renderer
	 * @Desc MainProcessからのメッセージ振り分け
	 * @Param {Void}
	 * @Return {Void}
	 */
	window.ipc.on('to-renderer', (event, obj) => {
		// console.log( '->', obj );
		// console.log('to-renderer, event:', event); eventは 'to-renderer' が入ってる
		let c = JSON.parse(obj);    // obj = {cmd, arg} の形式でくる
		// console.log(c);

		switch (c.cmd) {
			//----------------------------------------------
			// システム関連
			case "renewSystemConfigView":  // システム設定の画面表示変更
				console.log('main -> renewSystemConfigView:', c.arg);
				window.renewSystemConfigView(c.arg);
				break;

			case 'openSearch':
				console.log('main -> openSearch:');
				if (searchBox.style.display === 'block') {
					searchBox.style.display = 'none';
				} else {
					searchBox.style.display = 'block';
					searchInput.focus();  // 検索ボックスにフォーカスする
				}
				break;

			case 'foundResultShow':
				console.log('main -> foundResultShow:');
				searchResult.innerHTML = `${c.arg.activeMatchOrdinal} / ${c.arg.matches}`;
				break;

			//----------------------------------------------
			// ユーザプロファイル関連
			case "renewUserConfigView":  // user profileの画面表示変更
				console.log('main -> renewUserConfigView:', c.arg);
				window.renewUserConfigView(c.arg);
				break;

			//----------------------------------------------
			// HAL関連
			case "renewHALConfigView": // HAL情報（APIKey）
				console.log('main -> renewHALConfigView:', c.arg);
				window.renewHALConfigView(c.arg);
				break;

			case "HALRenewResponse": // HALのデータをもらった（評価値）
				console.log('main -> HALRenewResponse:', c.arg);
				halData = c.arg;
				window.HALRedraw(halData.MajorResults, halData.MinorResults, halData.MinorkeyMeans);
				break;

			case "HALgetApiTokenResponse": // HAL API トークン取得の応答
				console.log('main -> HALgetApiTokenResponse:', c.arg);
				getHalApiTokenCallback(c.arg);
				break;

			case "HALsetApiTokenResponse": // HAL API トークン設定の応答
				console.log('main -> HALsetApiTokenResponse:', c.arg);
				window.HALsetApiTokenResponse(c.arg);
				break;

			case "HALdeleteApiTokenResponse": // HAL API トークン設定削除の応答
				console.log('main -> HALdeleteApiTokenResponse:', c.arg);
				window.HALdeleteApiTokenResponse();
				break;

			case "HALgetUserProfileResponse": // HAL ユーザープロファイル取得の応答 c.arg.profile or c.arg.error
				console.log('main -> HALgetUserProfileResponse:', c.arg);
				window.HALgetUserProfileResponse(c.arg);
				break;

			case "HALSyncResponse":  // HAL cloud: 同期の応答、同期処理終了
				console.log('main -> HALSyncResponse:', c.arg);
				window.HALSyncResponse(c.arg);
				break;


			//----------------------------------------------
			// EL関連
			case "fclEL":
				console.log('main -> fclEL:', c.arg);
				window.renewFacilitiesEL(c.arg);
				break;

			case "renewELConfigView":
				console.log('main -> renewELConfigView');
				window.renewELConfigView(c.arg);
				break;


			//----------------------------------------------
			// 電力スマメ関連
			case "fclESM":
				// console.log('main -> fclESM:', c.arg);
				window.renewESM(c.arg);
				break;

			case "ESMLinked":
				console.log('main -> ESMLinked:');
				window.addToast('Info', '電力スマートメータとLinkしました');
				break;

			case "renewESMConfigView":
				console.log('main -> renewESMConfigView', c.arg);
				window.renewESMConfigView(c.arg);
				break;

			case "renewTodayElectricEnergy":  // WI-SUNのスマートメータ
				window.renewEnergy(c.arg);
				break;

			//----------------------------------------------
			// Philips hue関連
			case "fclHue":
				console.log('main -> fclHue:', c.arg);
				window.renewHueLog(JSON.stringify(c.arg, null, '  '));
				window.renewFacilitiesHue(c.arg);
				break;

			case "HueLinked": // HueとLinkできた
				console.log('main -> HueLinked:', c.arg);
				window.hueLinked(c.arg);
				break;

			case "renewHueConfigView":
				console.log('main -> renewHueConfigView:', c.arg);
				window.renewHueConfigView(c.arg);
				break;


			//----------------------------------------------
			// Ikea関連
			case "fclIkea":
				console.log('main -> fclIkea', c.arg);
				window.renewFacilitiesIkea(c.arg);
				break;

			case "renewIkeaConfigView":
				console.log('main -> renewIkeaConfigView', c.arg);
				window.renewIkeaConfigView(c.arg);
				break;



			//----------------------------------------------
			// OpenWeatherMap関連
			case "renewOwm": // OpenWeatherMapのデータをもらった
				console.log('main -> renewOwm:', c.arg);
				window.renewOwm(c.arg);
				break;

			case "renewOwmConfigView":  // Configを画面に表示
				console.log('main -> renewOwmConfigView:', c.arg);
				window.renewOwmConfigView(c.arg);
				break;


			//----------------------------------------------
			// 気象庁関連
			case "renewJmaAbst": // JMAのデータをもらった
				console.log('main -> renewJmaAbst:', c.arg);
				window.renewJmaAbst(c.arg);
				break;

			case "renewJmaDetail":
				console.log('main -> renewJmaDetail:', c.arg);
				window.renewJmaDetail(c.arg);
				break;

			case "renewJmaConfigView":
				console.log('main -> renewJmaConfigView', c.arg);
				window.renewJmaConfigView(c.arg);
				break;


			//----------------------------------------------
			// Netatmo関連
			case "renewNetatmo": // Netatmoのデータをもらった
				// console.log( 'main -> renewNetatmo:', c.arg );  // ログ多すぎる
				window.renewNetatmo(c.arg);
				break;

			case "renewNetatmoConfigView": // Netatmoの設定データをもらった
				console.log('main -> renewNetatmoConfigView:', c.arg);
				window.renewNetatmoConfigView(c.arg);
				break;


			//----------------------------------------------
			// Omron関連
			case "renewOmron": // Omronのデータをもらった
				// console.log( 'main -> renewOmron:', c.arg );  // ログ多過ぎるので必要な時だけ有効にする
				window.renewOmron(c.arg);
				break;

			case "omronDisconnected": // Omron切断
				console.log('main -> omronDisconnected:');  // ログ多過ぎるので必要な時だけ有効にする
				window.disconnectedOmron();
				break;

			case "renewOmronConfigView": // Omronの設定データをもらった
				console.log('main -> renewOmronConfigView:', c.arg);
				window.renewOmronConfigView(c.arg);
				break;


			//----------------------------------------------
			// UD-CO2S関連
			case "renewCo2s": // Co2sのデータをもらった
				// console.log( 'main -> renewCo2s:', c.arg );  // ログ多過ぎるので必要な時だけ有効にする
				window.renewCo2s(c.arg);
				break;

			case "co2sDisconnected": // Co2s切断
				console.log('main -> co2sDisconnected:');  // ログ多過ぎるので必要な時だけ有効にする
				window.disconnectedCo2s();
				break;

			case "renewCo2sConfigView": // Co2sの設定データをもらった
				console.log('main -> renewCo2sConfigView:', c.arg);
				window.renewCo2sConfigView(c.arg);
				break;


			//----------------------------------------------
			// SwitchBot関連
			case "fclSwitchBot":
				// console.log('main -> fclSwitchBot:', c.arg);
				window.renewFacilitiesSwitchBot(c.arg);
				break;

			case "renewSwitchBotConfigView":
				console.log('main -> renewSwitchBotConfigView:', c.arg);
				window.renewSwitchBotConfigView(c.arg);
				break;

			case "renewRoomEnvSwitchBot":
				// console.log( 'main -> renewRoomEnvSwitchBot:', c.arg );
				console.log('main -> renewRoomEnvSwitchBot');
				window.renewRoomEnvSwitchBot(c.arg);
				break;


			//----------------------------------------------
			// 部屋環境グラフ
			case "renewRoomEnvNetatmo":
				// console.log( 'main -> newRoomEnvNetatmo:', c.arg);   // ログ多すぎる
				console.log('main -> newRoomEnvNetatmo');
				window.renewRoomEnvNetatmo(c.arg);
				break;

			case "renewRoomEnvOmron":
				// console.log( 'main -> newRoomEnvOmron:', c.arg);   // ログ多すぎる
				console.log('main -> newRoomEnvOmron');
				window.renewRoomEnvOmron(c.arg);
				break;

			case "renewRoomEnvCo2s":
				// console.log( 'main -> renewRoomEnvCo2s:', c.arg);   // ログ多すぎる
				console.log('main -> renewRoomEnvCo2s');
				window.renewRoomEnvCo2s(c.arg);
				break;

			case "renewTodayElectricEnergy_submeter":  // Ether サブメータ
				window.renewEnergySubmeter(c.arg);
				break;


			//----------------------------------------------
			// カレンダー
			case "createCalendar":
				console.log('main -> createCalendar:');
				// console.log('main -> renewCalendar:', c.arg);
				window.createCalendar(c.arg);
				break;

			case "renewCalendar":
				console.log('main -> renewCalendar:');
				window.renewCalendar();
				break;

			//----------------------------------------------
			// PLIS全体
			case "myIPaddr":
				console.log('main -> myIPaddr:', c.arg);
				myIPaddr.innerHTML = 'My IP address list: ' + c.arg;
				break;

			case "configSaved": // 設定保存の応答
				console.log('main -> configSaved:', c.arg);
				if (c.arg.error) {
					alert(c.arg.error);
				}
				switch (c.arg) {
					case "System": window.SystemConfigSaved(); break;
					case "User": window.UserConfigSaved(); break;
					case "OWM": window.OwmConfigSaved(); break;
					case "JMA": window.JmaConfigSaved(); break;
					case "Hue": window.HueConfigSaved(); break;
					case "Ikea": window.IkeaConfigSaved(); break;
					case "Netatmo": window.NetatmoConfigSaved(); break;
					case "Omron": window.OmronConfigSaved(); break;
					case "EL": window.ELConfigSaved(); break;
					case "ESM": window.ESMConfigSaved(); break;
					case "SwitchBot": window.SwitchBotConfigSaved(); break;

					default:
						// window.alert('設定を保存しました。');
						window.addToast('Info', '${c.arg} 設定を保存しました。');
						break;
				}
				break;

			case "renewLicenses": // ライセンス表示の更新
				licenses = c.arg;
				renewLicenses();
				break;

			case "Info":
				console.log('main -> Info:', c.arg);
				window.addToast('Info', c.arg);
				break;

			case "Error":
				console.log('main -> Error:', c.arg);
				// c.arg = {datetime, moduleName, stackLog}
				window.addError(c.arg);  // このメソド内でToastする
				break;

			default:
				txtErrLog.value = JSON.stringify(c, null, '  ');
				console.log('main -> unknown cmd:', c.cmd, "arg:", c.arg);
				break;
		}
	});

	////////////////////////////////////////////////////////////////////////////////
	// user profile関係

	/**
	 * @Func renewLicenses
	 * @Desc ライセンス
	 * @Param {Void}
	 * @Return {Void}
	 */
	let renewLicenses = function () {
		// console.log( licenses );
		let doc = `<table class="sort_table" id="tblLicenses">`
			+ `<thead><tr><th>Name</th>` + `<th>Licenses</th>` + ` <th>Publisher</th>` + `<th>Repository</th><tr></thead><tbody>`;

		let keys = Object.keys(licenses);
		for (let k of keys) {
			doc += `<tr class="item"><td>${k}</td><td>${licenses[k].licenses}</td><td>${licenses[k].publisher}</td><td><a href='${licenses[k].repository}'>${licenses[k].repository}</a></td><tr>`;
		}

		doc += '</tbody></table>';

		divLicenses.innerHTML = doc;
	};


	//////////////////////////////////////////////////////////////////////
	// ボタン

	/**
	 * @Func window.pushHideButton
	 * @Desc テキストエリアを見せたり隠したり
	 * @Param {Void}
	 * @Return {Void}
	 */
	window.pushHideButton = function (field) {
		let txtPass = document.getElementById(field);
		let btnEye = document.getElementById(field + "ButtonEye");
		if (txtPass.type === "text") {
			txtPass.type = "password";
			btnEye.classList.remove("fa-eye-slash");
			btnEye.classList.add("fa-eye");
		} else {
			txtPass.type = "text";
			btnEye.classList.add("fa-eye-slash");
			btnEye.classList.remove("fa-eye");
		}
	};

	// tableをsortできるように準備
	let column_no = 0; //今回クリックされた列番号
	let column_no_prev = 0; //前回クリックされた列番号
	function sortReady() {
		document.querySelectorAll('table.sort_table thead th').forEach(elm => {  // classがsort_tableのものを改変
			elm.onclick = function () {
				column_no = this.cellIndex; //クリックされた列番号
				let table = this.parentNode.parentNode.parentNode;
				let sortType = 0; //0:数値 1:文字
				let sortArray = new Array; //クリックした列のデータを全て格納する配列
				for (let r = 1; r < table.rows.length; r++) {
					//行番号と値を配列に格納
					let column = new Object;
					column.row = table.rows[r];
					column.value = table.rows[r].cells[column_no].textContent;
					sortArray.push(column);
					//数値判定
					if (isNaN(Number(column.value))) {
						sortType = 1; //値が数値変換できなかった場合は文字列ソート
					}
				}
				if (sortType == 0) { //数値ソート
					if (column_no_prev == column_no) { //同じ列が2回クリックされた場合は降順ソート
						sortArray.sort(compareNumberDesc);
					} else {
						sortArray.sort(compareNumber);
					}
				} else { //文字列ソート
					if (column_no_prev == column_no) { //同じ列が2回クリックされた場合は降順ソート
						sortArray.sort(compareStringDesc);
					} else {
						sortArray.sort(compareString);
					}
				}
				//ソート後のTRオブジェクトを順番にtbodyへ追加（移動）
				let tbody = this.parentNode.parentNode;
				for (let i = 0; i < sortArray.length; i++) {
					tbody.appendChild(sortArray[i].row);
				}
				//昇順／降順ソート切り替えのために列番号を保存
				if (column_no_prev == column_no) {
					column_no_prev = -1; //降順ソート
				} else {
					column_no_prev = column_no;
				}
			};
		});
	}
	sortReady();

	//数値ソート（昇順）
	function compareNumber(a, b) {
		return a.value - b.value;
	}

	//数値ソート（降順）
	function compareNumberDesc(a, b) {
		return b.value - a.value;
	}

	//文字列ソート（昇順）
	function compareString(a, b) {
		if (a.value < b.value) {
			return -1;
		} else {
			return 1;
		}
		return 0;
	}

	//文字列ソート（降順）
	function compareStringDesc(a, b) {
		if (a.value > b.value) {
			return -1;
		} else {
			return 1;
		}
		return 0;
	}

	//////////////////////////////////////////////////////////////////////
	// ページ内検索
	// 検索開始
	window.btnSearchStart_Click = function () {
		window.ipc.PageInSearch(searchInput.value);
	}

	// 順検索
	window.btnSearchNext_Click = function () {
		window.ipc.PageInSearchNext(searchInput.value);
	}

	// 逆検索
	window.btnSearchPrev_Click = function () {
		window.ipc.PageInSearchPrev(searchInput.value);
	}

	// 検索終了
	window.btnSearchStop_Click = function () {
		searchBox.style.display = 'none';
		searchResult.innerHTML = '0 / 0';
		window.ipc.PageInSearchStop();
	}

	// escape key
	searchInput.addEventListener("keydown", (key) => {
		// console.log(key.code);
		if (key.code == 'Escape') {
			window.btnSearchStop_Click();
		}
	});

	//////////////////////////////////////////////////////////////////////
	// この関数の最後に呼ぶ
	// 準備できたことをmainプロセスに伝える
	window.ipc.already();
};
