//////////////////////////////////////////////////////////////////////
//	Copyright (C) SUGIMURA Lab. 2022.08.26
//////////////////////////////////////////////////////////////////////
'use strict'


////////////////////////////////////////////////////////////////////////////////
// HTMLロードしたら準備
/**
 * @namespace subELcontrol
 */
window.addEventListener('DOMContentLoaded', function () {
	console.dir('## DOMContentLoaded subELcontrol.js');

	let facilitiesEL = {};  // main.js の shallow copy、 createControlELButtonの呼び出しの時に毎回更新しておく


	////////////////////////////////////////////////////////////////////////////////
	/** 
	 * @func window.createControlELButton
	 * @desc ECHONET Lite, Each control interface
	 * @param {void}
	 * @return {void}
	 */
	window.createControlELButton = function (_facilitiesEL, ip, eoj) {
		facilitiesEL = _facilitiesEL; // ボタン更新とともに、facilitiesELも更新しておく

		let ret = "";
		let obj = "";
		try {
			obj = eoj.split(/\(|\)/);  // マルかっこで分割
		} catch (error) {
			console.error('Error: subEL.window.renewFacilitiesEL() control tab, error:', error);
			console.error('ip:', ip, 'eoj:', eoj);
			return;
		}

		if (obj[1] === '0ef001') { return; } // Node Profileはコントローラとしては無視, eachではcontinueではなくreturn

		let operatingStatus = facilitiesEL[ip][eoj]["動作状態(80)"];
		let instLocation = facilitiesEL[ip][eoj]["設置場所(81)"] || "不明";
		let makerCode = facilitiesEL[ip][eoj]["メーカコード(8A)"];

		// 機器オブジェクトになくて，ノードプロファイルにある読む場合
		if (makerCode == undefined && facilitiesEL[ip]["ノードプロファイル01(0ef001)"]) {
			makerCode = facilitiesEL[ip]["ノードプロファイル01(0ef001)"]["メーカコード(8A)"];
		}

		if (makerCode != undefined) {
			makerCode = makerCode.split('(')[0];  // メーカ名だけにする
		}

		// 画像
		// オブジェクトによって処理（インタフェース）を変える
		switch (obj[1].substring(0, 4)) {
			case "0011": // 温度センサ
				operatingStatus = facilitiesEL[ip][eoj]["温度計測値(E0)"];
				ret = "<div class='tooltip'><img src=\"./img/0011.png\" class='el-dev' /><div class='description'>" + makerCode + "&#013;&#010;" + ip + "</div></div><br>" + obj[0] + "<br>";
				ret += "場所:" + instLocation + "<br>";

				if (operatingStatus != undefined) {
					ret += operatingStatus + "<br>";
				}
				break;

			case "0022": // 電力量センサ
				let volt = undefined;
				if (facilitiesEL[ip][eoj]["実効電圧値計測値(E5)"]) {
					volt = facilitiesEL[ip][eoj]["実効電圧値計測値(E5)"].split('V')[0];
				}

				let watt = facilitiesEL[ip][eoj]["小容量センサ瞬時電力値計測値(E2)"];
				ret = "<div class='tooltip'><img src=\"./img/0022.png\" class='el-dev' /><div class='description'>" + makerCode + "&#013;&#010;" + ip + "</div></div><br>" + obj[0] + "<br>";
				ret += "場所:" + instLocation + "<br>";

				if (volt != undefined) {
					ret += volt + "[V]<br>";
				}
				if (watt != undefined) {
					ret += watt + "[W]<br>";
				}
				break;

			case "0130": // エアコン
				operatingStatus = facilitiesEL[ip][eoj]["動作状態(80)"];

				if (operatingStatus === 'ON(30)') {
					ret = `<div class='tooltip'><img src='./img/0130_30.png' class='el-dev' /><div class='description' onclick='window.ELAirconShowControlDialog("${ip}", "${eoj}")'>` + makerCode + "&#013;&#010;" + ip + "</div></div><br>" + obj[0] + "<br>";
					ret += "場所:" + instLocation + "<br>";
					ret += "<button onClick='ELpowButton(this);' value='" + ip + "," + obj[1] + ",80,31'>OFF</button><br>";
				} else {
					ret = `<div class='tooltip'><img src='./img/0130_31.png' class='el-dev' /><div class='description' onclick='window.ELAirconShowControlDialog("${ip}", "${eoj}")'>` + makerCode + "&#013;&#010;" + ip + "</div></div><br>" + obj[0] + "<br>";
					ret += "場所:" + instLocation + "<br>";
					ret += "<button onClick='ELpowButton(this);' value='" + ip + "," + obj[1] + ",80,30'>ON</button><br>";
				}
				break;

			case "0133": // 換気扇
				ret = "<div class='tooltip'><img src=\"./img/0133.png\" class='el-dev' /><div class='description'>" + makerCode + "&#013;&#010;" + ip + "</div></div><br>" + obj[0] + "<br>";
				ret += "場所:" + instLocation + "<br>";
				break;

			case "0135": // 空気清浄機
				operatingStatus = facilitiesEL[ip][eoj]["動作状態(80)"];
				if (operatingStatus === 'ON(30)') {
					ret = "<div class='tooltip'><img src=\"./img/0135_30.png\" class='el-dev' /><div class='description'>" + makerCode + "&#013;&#010;" + ip + "</div></div><br>" + obj[0] + "<br>";
					ret += "場所:" + instLocation + "<br>";
					ret += "<button onClick=\"ELpowButton(this);\" value=\"" + ip + "," + obj[1] + ",80,31\">OFF</button><br>";
				} else {
					ret = "<div class='tooltip'><img src=\"./img/0135_31.png\" class='el-dev' /><div class='description'>" + makerCode + "&#013;&#010;" + ip + "</div></div><br>" + obj[0] + "<br>";
					ret += "場所:" + instLocation + "<br>";
					ret += "<button onClick=\"ELpowButton(this);\" value=\"" + ip + "," + obj[1] + ",80,30\">ON</button><br>";
				}
				break;

			case "015a": // レンジフード
				operatingStatus = facilitiesEL[ip][eoj]["動作状態(80)"];
				if (operatingStatus === 'ON(30)') {
					ret = "<div class='tooltip'><img src=\"./img/015a_30.png\" class='el-dev' /><div class='description'>" + makerCode + "&#013;&#010;" + ip + "</div></div><br>" + obj[0] + "<br>";
					ret += "場所:" + instLocation + "<br>";
					ret += "<button onClick=\"ELpowButton(this);\" value=\"" + ip + "," + obj[1] + ",80,31\">OFF</button><br>";
				} else {
					ret = "<div class='tooltip'><img src=\"./img/015a_31.png\" class='el-dev' /><div class='description'>" + makerCode + "&#013;&#010;" + ip + "</div></div><br>" + obj[0] + "<br>";
					ret += "場所:" + instLocation + "<br>";
					ret += "<button onClick=\"ELpowButton(this);\" value=\"" + ip + "," + obj[1] + ",80,30\">ON</button><br>";
				}
				break;

			case "0260": // 日よけ・ブラインド
				operatingStatus = facilitiesEL[ip][eoj]["開閉（張出し／収納）動作設定(E0)"];
				ret = "<div class='tooltip'><img src=\"./img/0260.png\" class='el-dev' /><div class='description'>" + makerCode + "&#013;&#010;" + ip + "</div></div><br>" + obj[0] + "<br>";
				ret += "場所:" + instLocation + "<br>";
				if (operatingStatus === '開(41)') {
					ret += "開 → <button onClick=\"ELpowButton(this);\" value=\"" + ip + "," + obj[1] + ",E0,42\">閉</button><br>";
				} else {
					ret += "閉 → <button onClick=\"ELpowButton(this);\" value=\"" + ip + "," + obj[1] + ",E0,41\">開</button><br>";
				}
				break;

			case "0263": // シャッター
				ret = "<div class='tooltip'><img src=\"./img/0263.png\" class='el-dev' /><div class='description'>" + makerCode + "&#013;&#010;" + ip + "</div></div><br>" + obj[0] + "<br>";
				ret += "場所:" + instLocation + "<br>";
				break;


			case "026b": // 電気温水器
				ret = "<div class='tooltip'><img src=\"./img/026b.png\" class='el-dev' /><div class='description'>" + makerCode + "&#013;&#010;" + ip + "</div></div><br>" + obj[0] + "<br>";
				ret += "場所:" + instLocation + "<br>";
				break;

			case "026f": // 電気錠
				operatingStatus = facilitiesEL[ip][eoj]["施錠設定1(E0)"];
				if (operatingStatus === '施錠(41)') {
					ret = "<div class='tooltip'><img src=\"./img/026f_41.png\" class='el-dev' /><div class='description'>" + makerCode + "&#013;&#010;" + ip + "</div></div><br>" + obj[0] + "<br>";
					ret += "場所:" + instLocation + "<br>";
					ret += "<button onclick=\"window.ELpowButton(this);\" value=\"" + ip + "," + obj[1] + ",E0,42\">解錠</button><br>";
				} else {
					ret = "<div class='tooltip'><img src=\"./img/026f_42.png\" class='el-dev' /><div class='description'>" + makerCode + "&#013;&#010;" + ip + "</div></div><br>" + obj[0] + "<br>";
					ret += "場所:" + instLocation + "<br>";
					ret += "<button onclick=\"window.ELpowButton(this);\" value=\"" + ip + "," + obj[1] + ",E0,41\">施錠</button><br>";
				}
				break;

			case "0272": // 瞬間式給湯器
				ret = "<div class='tooltip'><img src=\"./img/0272.png\" class='el-dev' /><div class='description'>" + makerCode + "&#013;&#010;" + ip + "</div></div><br>" + obj[0] + "<br>";
				ret += "場所:" + instLocation + "<br>";
				break;

			case "0279": // 太陽光発電
				ret = "<div class='tooltip'><img src=\"./img/0279.png\" class='el-dev' /><div class='description'>" + makerCode + "&#013;&#010;" + ip + "</div></div><br>" + obj[0] + "<br>";
				ret += "場所:" + instLocation + "<br>";
				break;

			case "027b": // 床暖房
				operatingStatus = facilitiesEL[ip][eoj]["動作状態(80)"];
				if (operatingStatus === 'ON(30)') {
					ret = "<div class='tooltip'><img src=\"./img/027b_30.png\" class='el-dev' /><div class='description'>" + makerCode + "&#013;&#010;" + ip + "</div></div><br>" + obj[0] + "<br>";
					ret += "場所:" + instLocation + "<br>";
					ret += "<button onClick=\"ELpowButton(this);\" value=\"" + ip + "," + obj[1] + ",80,31\">OFF</button><br>";
				} else {
					ret = "<div class='tooltip'><img src=\"./img/027b_31.png\" class='el-dev' /><div class='description'>" + makerCode + "&#013;&#010;" + ip + "</div></div><br>" + obj[0] + "<br>";
					ret += "場所:" + instLocation + "<br>";
					ret += "<button onClick=\"ELpowButton(this);\" value=\"" + ip + "," + obj[1] + ",80,30\">ON</button><br>";
				}
				break;

			case "027c": // 燃料発電
				ret = "<div class='tooltip'><img src=\"./img/027c.png\" class='el-dev' /><div class='description'>" + makerCode + "&#013;&#010;" + ip + "</div></div><br>" + obj[0] + "<br>";
				ret += "場所:" + instLocation + "<br>";
				break;

			case "027d": // 蓄電池
				ret = "<div class='tooltip'><img src=\"./img/027d.png\" class='el-dev' /><div class='description'>" + makerCode + "&#013;&#010;" + ip + "</div></div><br>" + obj[0] + "<br>";
				ret += "場所:" + instLocation + "<br>";
				break;


			case "0280": // 電力量メータ
				// let amountGus = facilitiesEL[ip][eoj]["積算ガス消費量計測値(E0)"];
				ret = "<div class='tooltip'><img src=\"./img/0280.png\" class='el-dev' /><div class='description'>" + makerCode + "&#013;&#010;" + ip + "</div></div><br>" + obj[0] + "<br>";
				ret += "場所:" + instLocation + "<br>";
				// if (amountGus != undefined) {
				// ret += (amountGus.split('m')[0] * 0.001) + "[m<sup>3</sup>]<br>";
				// }
				break;

			case "0281": // 水流量メータ
				let amountWater = facilitiesEL[ip][eoj]["積算水流量計測値(E0)"];
				let unitAmountWater = facilitiesEL[ip][eoj]["積算水流量計測値単位(E1)"] != undefined ? facilitiesEL[ip][eoj]["積算水流量計測値単位(E1)"] : '0.0001(No data)';
				ret = "<div class='tooltip'><img src=\"./img/0281.png\" class='el-dev' /><div class='description'>" + makerCode + "&#013;&#010;" + ip + "</div></div><br>" + obj[0] + "<br>";
				ret += "場所:" + instLocation + "<br>";
				if (amountWater != undefined) {
					ret += (amountWater.split('m')[0] * unitAmountWater.split('(')[0]) + "[m<sup>3</sup>]<br>";
				}
				break;

			case "0282": // ガスメータ
				let amountGus = facilitiesEL[ip][eoj]["積算ガス消費量計測値(E0)"];
				ret = "<div class='tooltip'><img src=\"./img/0282.png\" class='el-dev' /><div class='description'>" + makerCode + "&#013;&#010;" + ip + "</div></div><br>" + obj[0] + "<br>";
				ret += "場所:" + instLocation + "<br>";
				if (amountGus != undefined) {
					ret += (amountGus.split('m')[0] * 0.001) + "[m<sup>3</sup>]<br>";
				}
				break;

			case "0287": // 分電盤メータリング
				operatingStatus = facilitiesEL[ip][eoj]["瞬時電力計測値(E7)"];
				ret = "<div class='tooltip'><img src=\"./img/0287.png\" class='el-dev' /><div class='description'>" + makerCode + "&#013;&#010;" + ip + "</div></div><br>" + obj[0] + "<br>";
				ret += "場所:" + instLocation + "<br>";
				if (operatingStatus != undefined) {
					ret += operatingStatus + "<br>";
				}
				break;

			case "0288": // 低圧スマート電力メータ
				operatingStatus = facilitiesEL[ip][eoj]["瞬時電力計測値(E7)"];
				ret = "<div class='tooltip'><img src=\"./img/0288.png\" class='el-dev' /><div class='description'>" + makerCode + "&#013;&#010;" + ip + "</div></div><br>" + obj[0] + "<br>";
				ret += "場所:" + instLocation + "<br>";
				if (operatingStatus != undefined) {
					ret += operatingStatus + "<br>";
				}
				break;

			case "028a": // 高圧スマート電力メータ
				operatingStatus = facilitiesEL[ip][eoj]["瞬時電力計測値(E7)"];
				ret = "<div class='tooltip'><img src=\"./img/028a.png\" class='el-dev' /><div class='description'>" + makerCode + "&#013;&#010;" + ip + "</div></div><br>" + obj[0] + "<br>";
				ret += "場所:" + instLocation + "<br>";
				if (operatingStatus != undefined) {
					ret += operatingStatus + "<br>";
				}
				break;


			case "028d": // スマート電力サブメーター
				ret = "<div class='tooltip'><img src=\"./img/028d.png\" class='el-dev' /><div class='description'>" + makerCode + "&#013;&#010;" + ip + "</div></div><br>" + obj[0] + "<br>";
				ret += "場所:" + instLocation + "<br>";
				break;

			case "0290": // 一般照明
				operatingStatus = facilitiesEL[ip][eoj]["動作状態(80)"];

				if (operatingStatus === 'ON(30)') {
					ret = "<div class='tooltip'><img src=\"./img/0290_30.png\" class='el-dev' /><div class='description'>" + makerCode + "&#013;&#010;" + ip + "</div></div><br>" + obj[0] + "<br>";
					ret += "場所:" + instLocation + "<br>";
					ret += "<button onclick=\"window.ELpowButton(this);\" value=\"" + ip + "," + obj[1] + ",80,31\">OFF</button><br>";
				} else {
					ret = "<div class='tooltip'><img src=\"./img/0290_31.png\" class='el-dev' /><div class='description'>" + makerCode + "&#013;&#010;" + ip + "</div></div><br>" + obj[0] + "<br>";
					ret += "場所:" + instLocation + "<br>";
					ret += "<button onclick=\"window.ELpowButton(this);\" value=\"" + ip + "," + obj[1] + ",80,30\">ON</button><br>";
				}
				break;

			case "0291": // 単機能照明
				operatingStatus = facilitiesEL[ip][eoj]["動作状態(80)"];

				if (operatingStatus === 'ON(30)') {
					ret = "<div class='tooltip'><img src=\"./img/0291_30.png\" class='el-dev' /><div class='description'>" + makerCode + "&#013;&#010;" + ip + "</div></div><br>" + obj[0] + "<br>";
					ret += "場所:" + instLocation + "<br>";
					ret += "<button onclick=\"window.ELpowButton(this);\" value=\"" + ip + "," + obj[1] + ",80,31\">OFF</button><br>";
				} else {
					ret = "<div class='tooltip'><img src=\"./img/0291_31.png\" class='el-dev' /><div class='description'>" + makerCode + "&#013;&#010;" + ip + "</div></div><br>" + obj[0] + "<br>";
					ret += "場所:" + instLocation + "<br>";
					ret += "<button onclick=\"window.ELpowButton(this);\" value=\"" + ip + "," + obj[1] + ",80,30\">ON</button><br>";
				}
				break;

			case "02a1": // 電気自動車充電器
				ret = "<div class='tooltip'><img src=\"./img/02a1.png\" class='el-dev' /><div class='description'>" + makerCode + "&#013;&#010;" + ip + "</div></div><br>" + obj[0] + "<br>";
				ret += "場所:" + instLocation + "<br>";
				break;

			case "02a6": // ハイブリッド給湯機
				ret = "<div class='tooltip'><img src=\"./img/02a6.png\" class='el-dev' /><div class='description'>" + makerCode + "&#013;&#010;" + ip + "</div></div><br>" + obj[0] + "<br>";
				ret += "場所:" + instLocation + "<br>";
				break;


			case "0273": // 浴室暖房乾燥機
				ret = "<div class='tooltip'><img src=\"./img/0273.png\" class='el-dev' /><div class='description'>" + makerCode + "&#013;&#010;" + ip + "</div></div><br>" + obj[0] + "<br>";
				ret += "場所:" + instLocation + "<br>";
				break;

			case "027e": // 電気自動車充放電気
				ret = "<div class='tooltip'><img src=\"./img/02a1.png\" class='el-dev' /><div class='description'>" + makerCode + "&#013;&#010;" + ip + "</div></div><br>" + obj[0] + "<br>";
				ret += "場所:" + instLocation + "<br>";
				break;

			case "02a3": // 照明システム
				operatingStatus = facilitiesEL[ip][eoj]["動作状態(80)"];
				let scineNow = facilitiesEL[ip][eoj]["シーン制御設定(C0)"];
				let scineNum = facilitiesEL[ip][eoj]["シーン制御設定可能数(C1)"];

				if (scineNum == undefined) {				// シーンの個数が取れていないので取りに行く
					// console.log( scineNum );
					window.ipc.Elsend(ip, '1081000005ff01' + obj[1] + '6201c100');
				}

				if (operatingStatus === 'ON(30)') {
					ret = "<div class='tooltip'><img src=\"./img/02a3_30.png\" class='el-dev' /><div class='description'>" + makerCode + "&#013;&#010;" + ip + "</div></div><br>" + obj[0] + "<br>";
					ret += "場所:" + instLocation + "<br>";
					ret += "<button onclick=\"window.ELpowButton(this);\" value=\"" + ip + "," + obj[1] + ",80,31\">Scine:" + scineNum + " / OFF</button><br>";
				} else {
					ret = "<div class='tooltip'><img src=\"./img/02a3_31.png\" class='el-dev' /><div class='description'>" + makerCode + "&#013;&#010;" + ip + "</div></div><br>" + obj[0] + "<br>";
					ret += "場所:" + instLocation + "<br>";
					ret += "<button onclick=\"window.ELpowButton(this);\" value=\"" + ip + "," + obj[1] + ",80,30\">ON</button><br>";
				}

				for (let i = 1; i <= 4; i += 1) { // シーンボタン，scineNumを使うべきだが，20とか数値が返ってくるので
					ret += "<button onclick=\"window.ELLightingScineButton(this);\" value=\"" + ip + "," + obj[1] + ",C0,0" + i + "\">" + i + "</button> ";
				}
				break;

			case "03b7": // 冷蔵庫
				ret = "<div class='tooltip'><img src=\"./img/03b7.png\" class='el-dev' /><div class='description'>" + makerCode + "&#013;&#010;" + ip + "</div></div><br>" + obj[0] + "<br>";
				ret += "場所:" + instLocation + "<br>";
				break;

			case "03b8": // 電子レンジ
				ret = "<div class='tooltip'><img src=\"./img/03b8.png\" class='el-dev' /><div class='description'>" + makerCode + "&#013;&#010;" + ip + "</div></div><br>" + obj[0] + "<br>";
				ret += "場所:" + instLocation + "<br>";
				break;

			case "03d3": // 洗濯機
				ret = "<div class='tooltip'><img src=\"./img/03d3.png\" class='el-dev' /><div class='description'>" + makerCode + "&#013;&#010;" + ip + "</div></div><br>" + obj[0] + "<br>";
				ret += "場所:" + instLocation + "<br>";
				break;

			case "03cb": // 掃除機
				ret = "<div class='tooltip'><img src=\"./img/03cb.png\" class='el-dev' /><div class='description'>" + makerCode + "&#013;&#010;" + ip + "</div></div><br>" + obj[0] + "<br>";
				ret += "場所:" + instLocation + "<br>";
				break;


			case "05fd": // スイッチ JEMA/HA
				operatingStatus = facilitiesEL[ip][eoj]["動作状態(80)"];

				if (operatingStatus === 'ON(30)') {
					ret = "<div class='tooltip'><img src=\"./img/05fd_30.png\" class='el-dev' /><div class='description'>" + makerCode + "&#013;&#010;" + ip + "</div></div><br>" + obj[0] + "<br>";
					ret += "場所:" + instLocation + "<br>";
					ret += "<button onclick=\"window.ELpowButton(this);\" value=\"" + ip + "," + obj[1] + ",80,31\">OFF</button><br>";
				} else {
					ret = "<div class='tooltip'><img src=\"./img/05fd_31.png\" class='el-dev' /><div class='description'>" + makerCode + "&#013;&#010;" + ip + "</div></div><br>" + obj[0] + "<br>";
					ret += "場所:" + instLocation + "<br>";
					ret += "<button onclick=\"window.ELpowButton(this);\" value=\"" + ip + "," + obj[1] + ",80,30\">ON</button><br>";
				}
				break;

			case "05ff": // コントローラ
				ret = "<div class='tooltip'><img src=\"./img/05ff.png\" class='el-dev' /><div class='description'>" + makerCode + "&#013;&#010;" + ip + "</div></div><br class='omitable'>" + obj[0] + "<br>";
				ret += "場所:" + instLocation + "<br>";
				break;


			case "0602": // テレビ
				operatingStatus = facilitiesEL[ip][eoj]["動作状態(80)"];

				if (operatingStatus === 'ON(30)') {
					ret = "<div class='tooltip'><img src=\"./img/0602_30.png\" class='el-dev' /><div class='description'>" + makerCode + "&#013;&#010;" + ip + "</div></div><br>" + obj[0] + "<br>";
					ret += "場所:" + instLocation + "<br>";
					ret += "<button onclick=\"window.ELpowButton(this);\" value=\"" + ip + "," + obj[1] + ",80,31\">OFF</button><br>";
				} else {
					ret = "<div class='tooltip'><img src=\"./img/0602_31.png\" class='el-dev' /><div class='description'>" + makerCode + "&#013;&#010;" + ip + "</div></div><br>" + obj[0] + "<br>";
					ret += "場所:" + instLocation + "<br>";
					ret += "<button onclick=\"window.ELpowButton(this);\" value=\"" + ip + "," + obj[1] + ",80,30\">ON</button><br>";
				}
				break;

			default:
				console.log('subELcontrols.createControlELButton(), no case device, using default:', ip, eoj);
				// console.dir(facilitiesEL[ip][eoj]);
				ret = `<div class='tooltip'><img src='./img/${obj[1].substring(0, 2)}.png' class='el-dev' /><div class='description'>${makerCode}&#013;&#010;${ip}</div></div><br class='omitable'>${obj[0]}<br>`;
				ret += "場所:" + instLocation + "<br>";
				break;
		}

		return ret;
	};

	////////////////////////////////////////////////////////////////////////////////////////////////////
	/** 
	 * @func window.ELSettings
	 * @desc GUIイベント，関数で閉じてしまっているので，Global変数のWindowからアクセスできるようにしておく
	 * @param {void}
	 * @return {void}
	 */
	window.ELSettings = function (ip, obj) {
		let eoj = obj.split(/\(|\)/)[1];  // マルかっこで分割
		console.log('ELSettings ip:', ip, 'obj:', obj, 'eoj:', eoj);

		if (eoj === '0ef001') { return; } // Node Profileはコントローラとしては無視, eachではcontinueではなくreturn

		let instLocation = facilitiesEL[ip][obj]["設置場所(81)"] || "不明";

		ELSettingsContents.innerHTML = "<form>";
		ELSettingsContents.innerHTML += "設置場所（現在）:" + instLocation + "<i class='fa-solid fa-right-long'></i>"
			+ "設置場所（変更後）:"
			+ "<select id='UpdateInstLocation' id='UpdateInstLocationSelecter'> \
				  <option value='08'>居間、リビング</option> \
				  <option value='10'>食堂、ダイニング</option> \
				  <option value='18'>台所、キッチン</option> \
				  <option value='20'>浴槽、バス</option> \
				  <option value='28'>トイレ</option> \
				  <option value='30'>洗面所、脱衣所</option> \
				  <option value='38'>廊下</option> \
				  <option value='40'>部屋</option> \
				  <option value='48'>階段</option> \
				  <option value='50'>玄関</option> \
				  <option value='58'>納屋</option> \
				  <option value='60'>庭、外周</option> \
				  <option value='68'>車庫</option> \
				  <option value='70'>ベランダ、バルコニー</option> \
				  <option value='78'>その他</option> \
				  <option value='00'>未設定</option> \
				  <option value='ff'>不定</option> \
				</select>" ;

		ELSettingsContents.innerHTML += "</form>";

		ELSettingsContents.innerHTML += `<button type='button' onclick='window.ELUpdateSettings("${ip}", "${eoj}");document.getElementById("ELSettingsDialog").close();'>更新</button>`
			+ '<button type="button" onclick="document.getElementById(\'ELSettingsDialog\').close()">キャンセル</button>';

		ELSettingsDialog.showModal();
	};

	/** 
	 * @func window.ELUpdateSettings
	 * @desc 設定更新ボタン
	 * @param {void}
	 * @return {void}
	 */
	window.ELUpdateSettings = function (ip, eoj) {
		console.log("window.ELUpdateSettings");
		let newLocation = document.getElementById('UpdateInstLocation');
		window.ELUpdateLocation(ip, eoj, newLocation.value);
	};


	/** 
	 * @func window.ELSendTest
	 * @desc 送信ボタンが押された
	 * @param {void}
	 * @return {void}
	 */
	window.ELSendTest = function () {
		let msg = "10810000" + eltestSEOJ.value + eltestDEOJ.value + eltestESV.value + "01" + eltestEPC.value + eltestDETAILs.value;
		window.ipc.Elsend(toIP.value, msg);
	};

	/** 
	 * @func window.ELpowButton
	 * @desc 電源ボタンが押された
	 * @param {void}
	 * @return {void}
	 */
	window.ELpowButton = function (btn) {
		let cmd = btn.value.split(",");
		let msg = "1081000005ff01" + cmd[1] + "6101" + cmd[2] + "01" + cmd[3];
		window.ipc.Elsend(cmd[0], msg);
	};

	/** 
	 * @func colorButton
	 * @desc 色変化
	 * @memberof subELcontrol
	 * @param {void}
	 * @return {void}
	 */
	let colorButton = function (btn) {
		let cmd = btn.name.split(",");
		let col = btn.value;
		let msg = cmd[0] + " " + "1081000005ff01" + cmd[1] + "6101c003" + col.substring(1, 7);

		window.ipc.ELsend(cmd[0], msg);
	};

	/** 
	 * @func window.ELLightingScineButton
	 * @desc window.ELLightingScineButton
	 * @param {void}
	 * @return {void}
	 */
	window.ELLightingScineButton = function (btn) {
		let cmd = btn.value.split(",");
		let msg = "1081000005ff01" + cmd[1] + "6101" + cmd[2] + "01" + cmd[3];
		window.ipc.Elsend(cmd[0], msg);
	};

	/** 
	 * @func window.ELUpdateLocation
	 * @desc 設置場所変更
	 * @param {void}
	 * @return {void}
	 */
	window.ELUpdateLocation = function (ip, eoj, location) {
		console.log(ip, eoj, location);
		let msg = "1081000005ff01" + eoj + "61018101" + location;
		window.ipc.Elsend(ip, msg);
		// window.ipc.ElsendOPC1(ip, [0x05,0xff,0x01], eoj, 0x61, 0x81, location );  // HTML内部の文字を数値&配列にするのがめんどい
	};

	/** 
	 * @func window.ELAirconShowControlDialog
	 * @desc エアコンの詳細コントロールダイアログを表示
	 * @param {void}
	 * @return {void}
	 */
	window.ELAirconShowControlDialog = function (ip, obj) {
		let eoj = obj.split(/\(|\)/)[1];  // 丸括弧 = Parenthesisで分割
		// console.log('ELAirconShowControlDialog:', ip, eoj);

		ELSettingsContents.innerHTML = "<form>"
			+ `<input type='radio' name='elaircon_mode' value='automatic' onclick='window.ELAAirconChangeMode(this, "${ip}", "${eoj}")'>自動<br>`
			+ `<input type='radio' name='elaircon_mode' value='cooling' onclick='window.ELAAirconChangeMode(this, "${ip}", "${eoj}")'>冷房<br>`
			+ `<input type='radio' name='elaircon_mode' value='heating' onclick='window.ELAAirconChangeMode(this, "${ip}", "${eoj}")'>暖房<br>`
			+ `<input type='radio' name='elaircon_mode' value='defumidication' onclick='window.ELAAirconChangeMode(this, "${ip}", "${eoj}")''>除湿<br>`
			+ `<input type='radio' name='elaircon_mode' value='aircirculator' onclick='window.ELAAirconChangeMode(this, "${ip}", "${eoj}")'>送風<br>`
			+ `<input type='radio' name='elaircon_mode' value='other' onclick='window.ELAAirconChangeMode(this, "${ip}", "${eoj}")'>その他<br>`
			+ `</form>`
			+ '<button type="button" onclick="this.parentNode.parentNode.parentNode.close()">閉じる</button>';

		let radios = document.getElementsByName('elaircon_mode');
		let mode = facilitiesEL[ip][obj]["運転モード設定(B0)"];

		switch (mode) {
			case '自動(41)': radios[0].checked = true; break;
			case '冷房(42)': radios[1].checked = true; break;
			case '暖房(43)': radios[2].checked = true; break;
			case '除湿(44)': radios[3].checked = true; break;
			case '送風(45)': radios[4].checked = true; break;
			case 'その他(40)': radios[5].checked = true; break;
			default: break;  // Undefined, NULL 対策
		}

		ELSettingsDialog.showModal();
	}

	/** 
	 * @func
	 * @desc エアコンのモード切り替え（詳細コントロールダイアログから呼ばれる）
	 * @param {void}
	 * @return {void}
	 */
	window.ELAAirconChangeMode = function (radio, ip, eoj) {
		// console.log(ip, eoj, radio.value);
		let msg = "1081000005ff01" + eoj + "6101B001";
		switch (radio.value) {
			case 'cooling': msg += '42'; break;
			case 'heating': msg += '43'; break;
			case 'defumidication': msg += '44'; break;
			case 'aircirculator': msg += '45'; break;
			case 'other': msg += '40'; break;
			case 'automatic':
			default:
				msg += '41'; break;
		}

		window.ipc.Elsend(ip, msg);
	}


	/** 
	 * @func window.ELpowButton
	 * @desc 電源ボタンが押された
	 * @param {void}
	 * @return {void}
	 */
	window.ELpowButton = function (btn) {
		let cmd = btn.value.split(",");
		let msg = "1081000005ff01" + cmd[1] + "6101" + cmd[2] + "01" + cmd[3];
		window.ipc.Elsend(cmd[0], msg);
	};


});
//////////////////////////////////////////////////////////////////////
// EOF
//////////////////////////////////////////////////////////////////////
