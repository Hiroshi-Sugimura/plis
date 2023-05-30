//////////////////////////////////////////////////////////////////////
//	Copyright (C) SUGIMURA Lab. 2021.11.05
//	HAL 表示関係の処理
//////////////////////////////////////////////////////////////////////
/**
 * @module subHAL
 */
'use strict'


////////////////////////////////////////////////////////////////////////////////
// HTMLロードしたら準備
window.addEventListener('DOMContentLoaded', function () {
	console.dir('## DOMContentLoaded subHAL.js');

	// 内部変数
	let profile = { name: 'No Profile', UID: 'No Data', sex: 'No Data', age: 'No Data' };
	let majorResults = {};
	let minorResults = {};
	let minorkeyMeans = {};

	// HTML内部とリンク
	let divHALArea = document.getElementById('divHALArea');

	let divId = document.getElementById("divId");
	let divDatetime = document.getElementById("divDatetime");
	let divTotalPoint = document.getElementById("divTotalPoint");
	let divTotalRank = document.getElementById("divTotalRank");
	let divSLI = document.getElementById("divSLI");
	let divClothing = document.getElementById("divClothing");
	let divFood = document.getElementById("divFood");
	let divHousing = document.getElementById("divHousing");
	let divPhysicalHealth = document.getElementById("divPhysicalHealth");
	let divMentalHealth = document.getElementById("divMentalHealth");
	let divEcology = document.getElementById("divEcology");
	let divClothingRatio = document.getElementById('divClothingRatio');
	let divFoodRatio = document.getElementById('divFoodRatio');
	let divHousingRatio = document.getElementById('divHousingRatio');
	let divPhysicalRatio = document.getElementById('divPhysicalRatio');
	let divMentalRatio = document.getElementById('divMentalRatio');
	let divEcologyRatio = document.getElementById('divEcologyRatio');
	let divHALPoint = document.getElementById('divHALPoint');

	let divComment = document.getElementById("divComment");
	let imgKadecot = document.getElementById("imgKadecot");
	let imgSmartilab = document.getElementById("imgSmartilab");
	let imgSugilab = document.getElementById("imgSugilab");

	let canMajorRaderChart = document.getElementById("canMajorRaderChart");

	// 詳細
	let canClothingBarChart = document.getElementById("canClothingBarChart");
	let canFoodBarChart = document.getElementById("canFoodBarChart");
	let canHousingBarChart = document.getElementById("canHousingBarChart");
	let canPhysicalBarChart = document.getElementById("canPhysicalBarChart");
	let canMentalBarChart = document.getElementById("canMentalBarChart");
	let canEcologyBarChart = document.getElementById("canEcologyBarChart");

	// config
	let inHALApiKey = document.getElementById('inHALApiKey');  // HALApiKey
	let spanHALinfo = document.getElementById('spanHALinfo');  // tokenが登録されているとき
	let spanHALsuggenst = document.getElementById('spanHALsuggenst');  // token未登録のとき
	let pSetHalApiTokenErr = document.getElementById('pSetHalApiTokenErr');  // API登録エラー表示

	let inUserNickname = document.getElementById('inUserNickname');  // ニックネーム
	let inUserAge = document.getElementById('inUserAge');  // 年齢
	let inUserHeight = document.getElementById('inUserHeight');  // 身長
	let inUserWeight = document.getElementById('inUserWeight');  // 体重

	let btnSetHalApiToken = document.getElementById('btnSetHalApiToken');  // API Key登録ボタン
	let btnHALSync = document.getElementById('btnHALSync');  // HAL同期ボタン

	/** 
	 * @func renewMajorResults
	 * @desc 内部関数
	 * @param {void}
	 * @return {void}
	 */
	let renewMajorResults = function () {
		if (!majorResults) return;
		let clothingRatio = ranking(majorResults.clothingPoint);
		let foodRatio = ranking(majorResults.foodPoint);
		let housingRatio = ranking(majorResults.housingPoint);
		let physicalRatio = ranking(majorResults.physicalHealthPoint);
		let mentalRatio = ranking(majorResults.mentalHealthPoint);
		let ecologyRatio = ranking(majorResults.ecologyPoint);

		let majorRaderChart = new Chart(canMajorRaderChart, {
			type: 'radar',
			data: {
				labels: ["衣服・身だしなみ", "食事", "住居", "体の健康", "心の健康", "エコ度"],
				datasets: [{
					label: '今日のあなた',
					data: [majorResults.clothingPoint, majorResults.foodPoint, majorResults.housingPoint,
						   majorResults.physicalHealthPoint, majorResults.mentalHealthPoint, majorResults.ecologyPoint],
					backgroundColor: 'RGBA(225,95,150, 0.5)',
					borderColor: 'RGBA(225,95,150, 1)',
					borderWidth: 1,
					pointBackgroundColor: 'RGB(46,106,177)'
				}]
			},
			options: {
				responsive: true,
				title: {
					display: true,
					text: 'あなたの生活評価バランス',
					fontSize: '30'
				},
				scale: {
					r: {
						suggestedMax: 100,
						suggestedMin: 0,
						beginAtZero: true
					}
				}
			}
		});

		divId.innerHTML = profile.name;
		divDatetime.innerHTML = new Date(majorResults.updatedAt).toLocaleString();
		divTotalPoint.innerHTML = Math.round(majorResults.totalPoint * 10) / 10;
		divHALPoint.innerHTML = Math.round(majorResults.totalPoint * 10) / 10;
		divTotalRank.innerHTML = majorResults.totalRank;
		divSLI.innerHTML = majorResults.smartLifeIndex;
		divClothing.innerHTML = Math.round(majorResults.clothingPoint * 10) / 10;
		divFood.innerHTML = Math.round(majorResults.foodPoint * 10) / 10;
		divHousing.innerHTML = Math.round(majorResults.housingPoint * 10) / 10;
		divPhysicalHealth.innerHTML = Math.round(majorResults.physicalHealthPoint * 10) / 10;
		divMentalHealth.innerHTML = Math.round(majorResults.mentalHealthPoint * 10) / 10;
		divEcology.innerHTML = Math.round(majorResults.ecologyPoint * 10) / 10;

		divClothingRatio.innerHTML = clothingRatio;
		divFoodRatio.innerHTML = foodRatio;
		divHousingRatio.innerHTML = housingRatio;
		divPhysicalRatio.innerHTML = physicalRatio;
		divMentalRatio.innerHTML = mentalRatio;
		divEcologyRatio.innerHTML = ecologyRatio;

		divComment.innerHTML = majorResults.comments ? majorResults.comments : "この調子で頑張ろう！";
	};

	/** 
	 * @func renewMinorResults
	 * @desc 内部関数
	 * @param {void}
	 * @return {void}
	 */
	let renewMinorResults = function () {
		if (!minorResults) return;

		// 両方揃わないでグラフを作るとChart.jsがバグる
		if (Object.keys(minorResults).length == 0) return;
		if (Object.keys(minorkeyMeans).length == 0) return;

		let clothingLabels = [];
		let clothingData = [];
		let foodLabels = [];
		let foodData = [];
		let housingLabels = [];
		let housingData = [];
		let physicalLabels = [];
		let physicalData = [];
		let mentalLabels = [];
		let mentalData = [];
		let ecologyLabels = [];
		let ecologyData = [];

		Object.keys(minorkeyMeans).forEach(function (key) {
			let d = minorkeyMeans[key];
			switch (d.majorKey) {
				case 1:
				clothingLabels[d.minorKey - 1] = d.means;
				break;
				case 2:
				foodLabels[d.minorKey - 1] = d.means;
				break;
				case 3:
				housingLabels[d.minorKey - 1] = d.means;
				break;
				case 4:
				physicalLabels[d.minorKey - 1] = d.means;
				break;
				case 5:
				mentalLabels[d.minorKey - 1] = d.means;
				break;
				case 6:
				ecologyLabels[d.minorKey - 1] = d.means;
				break;
			}
		});

		Object.keys(minorkeyMeans).forEach(function (key) {
			let d = minorkeyMeans[key];
			switch (d.majorKey) {
				case 1:
				clothingData[d.minorKey - 1] = minorResults['r_' + d.majorKey + '_' + d.minorKey];
				break;
				case 2:
				foodData[d.minorKey - 1] = minorResults['r_' + d.majorKey + '_' + d.minorKey];
				break;
				case 3:
				housingData[d.minorKey - 1] = minorResults['r_' + d.majorKey + '_' + d.minorKey];
				break;
				case 4:
				physicalData[d.minorKey - 1] = minorResults['r_' + d.majorKey + '_' + d.minorKey];
				break;
				case 5:
				mentalData[d.minorKey - 1] = minorResults['r_' + d.majorKey + '_' + d.minorKey];
				break;
				case 6:
				ecologyData[d.minorKey - 1] = minorResults['r_' + d.majorKey + '_' + d.minorKey];
				break;
			}
		});


		// 衣類
		let clothingBarCart = new Chart(canClothingBarChart, {
			type: 'bar',
			data: {
				labels: clothingLabels,
				datasets: [
					{
						label: 'あなたの衣服・身だしなみの点数',
						data: clothingData,
						backgroundColor: "#dda0dd"
					}
					]
			},
			options: {
				title: {
					display: true,
					text: '衣服・身だしなみ'
				},
				scales: {
					y: {
						suggestedMax: 100,
						suggestedMin: 0
					}
				}
			}
		});


		// 食
		let foodBarChart = new Chart(canFoodBarChart, {
			type: 'bar',
			data: {
				labels: foodLabels,
				datasets: [
					{
						label: 'あなたの食事の点数',
						data: foodData,
						backgroundColor: "#ffa500"

					}
					]
			},
			options: {
				title: {
					display: true,
					text: '食事'
				},
				scales: {
					y: {
						suggestedMax: 100,
						suggestedMin: 0
					}
				}
			}
		});

		// 住居
		let housingBarChart = new Chart(canHousingBarChart, {
			type: 'bar',
			data: {
				labels: housingLabels,
				datasets: [
					{
						label: 'あなたの住居の点数',
						data: housingData,
						backgroundColor: "#6495ed"

					}
					]
			},
			options: {
				title: {
					display: true,
					text: '住居'
				},
				scales: {
					y: {
						suggestedMax: 100,
						suggestedMin: 0
					}
				}
			}
		});

		// 体
		let physicalBarChart = new Chart(canPhysicalBarChart, {
			type: 'bar',
			data: {
				labels: physicalLabels,
				datasets: [
					{
						label: 'あなたの体の健康の点数',
						data: physicalData,
						backgroundColor: "#9acd32"

					}
					]
			},
			options: {
				title: {
					display: true,
					text: '体の健康'
				},
				scales: {
					y: {
						suggestedMax: 100,
						suggestedMin: 0
					}
				}
			}
		});

		// 心
		let mentalBarChart = new Chart(canMentalBarChart, {
			type: 'bar',
			data: {
				labels: mentalLabels,
				datasets: [
					{
						label: 'あなたの心の健康の点数',
						data: mentalData,
						backgroundColor: "#ffc0cb"

					}
					]
			},
			options: {
				title: {
					display: true,
					text: '心の健康'
				},
				scales: {
					y: {
						suggestedMax: 100,
						suggestedMin: 0
					}
				}
			}
		});

		// エコ
		let ecologyBarChart = new Chart(canEcologyBarChart, {
			type: 'bar',
			data: {
				labels: ecologyLabels,
				datasets: [
					{
						label: 'あなたのエコ度の点数',
						data: ecologyData,
						backgroundColor: "#c0c0c0"
					}
					]
			},
			options: {
				title: {
					display: true,
					text: 'エコ度'
				},
				scales: {
					y: {
						suggestedMax: 100,
						suggestedMin: 0
					}
				}
			}
		});
	};

	/** 
	 * @func ranking
	 * @desc 内部関数，ランク付け
	 * @param {void}
	 * @return {void}
	 */
	let ranking = function (point) {
		return point >= 90 ? 'SSS'
			: point >= 80 ? 'SS'
				: point >= 70 ? 'S'
					: point >= 60 ? 'A'
						: point >= 50 ? 'B'
							: point >= 40 ? 'C'
								: point >= 30 ? 'D'
									: point >= 20 ? 'E'
										: 'F';
	};


	/** 
	 * @func window.renewHALProfile
	 * @desc Profileもらって画面更新
	 * @param {void}
	 * @return {void}
	 */
	window.renewHALProfile = function (_profile) {
		profile = _profile;
		divId.innerHTML = profile.name;

		// HALのデータを優先し、read onlyにする
		inUserNickname.value = profile.name;
		inUserNickname.readOnly = true;
		inUserAge.value = profile.age;
		inUserAge.readOnly = true;
		// inUserHeight.value   = profile.height;
		// inUserWeight.value   = profile.weight;
	};

	////////////////////////////////////////////////////////////////////////////////
	// GUIのボタン

	/** 
	 * @func window.btnDeleteHalApiToken_Click
	 * @desc HAL API トークン設定削除ボタンが押されたときの処理
	 * @param {void}
	 * @return {void}
	 */
	window.btnDeleteHalApiToken_Click = function () {
		window.ipc.HALdeleteApiToken();
	};

	// HAL API Key登録ボタンクリック
	let timer;  // HALからの応答待ち、タイムアウトタイマー

	/** 
	 * @func window.btnSetHalApiTokenBtn_Click
	 * @desc window.btnSetHalApiTokenBtn_Click
	 * @param {void}
	 * @return {void}
	 */
	window.btnSetHalApiTokenBtn_Click = function () {
		pSetHalApiTokenErr.textContent = '';
		btnSetHalApiToken.disabled = true;

		let HALtoken = inHALApiKey.value;
		let err = '';
		if (!HALtoken) {
			err = 'API トークンを入力してください。';
		} else if (!/^[\x21-\x7e]+$/.test(HALtoken)) {
			err = 'API トークンに不適切な文字が含まれています。';
		}

		if (err) {
			pSetHalApiTokenErr.textContent = err;
			btnSetHalApiToken.disabled = false;
			return;
		}

		let HAL_REQUEST_TIMEOUT = 5000;

		timer = setTimeout(() => {
			pSetHalApiTokenErr.textContent = 'TIMEOUT: HAL の応答がありませんでした。';
			btnSetHalApiToken.disabled = false;
		}, HAL_REQUEST_TIMEOUT);

		window.ipc.HALsetApiTokenRequest(HALtoken);
	};

	/** 
	 * @func window.btnHALsync_Click
	 * @desc HAL同期ボタンが押されたときの処理
	 * @param {void}
	 * @return {void}
	 */
	window.btnHALsync_Click = function () {
		btnHALSync.disabled = true;
		btnHALSync.textContent = '同期中…';
		window.ipc.HALsync();
	};


	////////////////////////////////////////////////////////////////////////////////
	// mainプロセスから呼ばれるやつ

	//----------------------------------------------------------------
	/** 
	 * @func window.renewHALConfigView
	 * @desc configデータをもらって画面更新
	 * @param {void}
	 * @return {void}
	 */
	window.renewHALConfigView = function (config) {
		// 取得したトークンが有効かどうかを確認するために HAL ユーザープロファイルを取得
		if (config.halApiToken) {
			inHALApiKey.value = config.halApiToken;
			window.ipc.HALgetUserProfileRequest();
		}else{
			inHALApiKey.value = "";  // undefined がテキストボックスに表示されないように
		}
	};

	/** 
	 * @func window.renewHALToken
	 * @desc HAL Tokenに変更があったら呼ばれる
	 * @param {void}
	 * @return {void}
	 */
	window.renewHALToken = async function (HALtoken) {
		console.log('renewHALToken(): HALtoken:', HALtoken);

		// 取得したトークンが有効かどうかを確認するために HAL ユーザープロファイルを取得
		if (HALtoken) {
			inHALApiKey.value = HALtoken;
			window.ipc.HALgetUserProfileRequest();
		} else {
			spanHALinfo.style.display     = 'none';  // 同期済み情報表示
			spanHALsuggenst.style.display = 'block';   // 同期済み情報表示
			inHALApiKey.value = "";  // undefined がテキストボックスに表示されないように
		}
	};

	//----------------------------------------------------------------
	/** 
	 * @func window.renewHAL
	 * @desc データをもらって画面更新
	 * @param {void}
	 * @return {void}
	 */
	window.renewHAL = function (MajorResults, MinorResults, MinorkeyMeans) {
		majorResults = MajorResults;
		renewMajorResults();

		minorResults = MinorResults;
		renewMinorResults();

		minorkeyMeans = MinorkeyMeans;
		renewMinorResults();
	};


	//----------------------------------------------------------------
	/** 
	 * @func window.HALsyncResponse
	 * @desc HAL cloud: 同期の応答、同期処理終了
	 * @param {void}
	 * @return {void}
	 */
	window.HALsyncResponse = function ( arg ) {
		console.log( 'main -> HALsyncResponse:' );
		if(arg?.error) {
			alert(arg.error);
		}else{
			syncBtn.disabled = false;
			syncBtn.textContent = '同期開始';
			window.ipc.HALrenew();			// 同期成功したなら最新のHALもらう
		}
	}

	//----------------------------------------------------------------
	/** 
	 * @func window.HALsetApiTokenResponse
	 * @desc HAL API登録完了したら呼ばれる
	 * @param {void}
	 * @return {void}
	 */
	window.HALsetApiTokenResponse = function (res) {
		console.log('window.HALsetApiTokenResponse() res:', res);

		if (timer) {
			clearTimeout(timer);
		}
		if (res.error) {
			pSetHalApiTokenErr.textContent = res.error;
		} else {
			btnHALSync.style.display      = 'block';  // 同期ボタン表示
			spanHALinfo.style.display     = 'block';  // 同期済み情報表示
			spanHALsuggenst.style.display = 'none';   // 同期済み情報表示
			window.addToast('Info', 'HAL 連携が成功しました。');
			window.renewHALToken(inHALApiKey.value);
			// configSave();

			// 同期もする
			btnHALSync.disabled = true;
			btnHALSync.textContent = '同期中…';
			window.ipc.HALsync();
		}
	};


	//----------------------------------------------------------------
	/** 
	 * @func window.HALdeleteApiTokenResponse
	 * @desc HAL API トークン設定削除の応答、HALとの同期をやめた場合、mainから応答があって実行
	 * @param {void}
	 * @return {void}
	 */
	window.HALdeleteApiTokenResponse = function () {
		console.log('window.HALdeleteApiTokenResponse()');
		divHALArea.style.display = 'none';  // 同期ボタン非表示
		window.addToast('Info', 'HAL 連携設定を削除しました。');
		window.renewHALToken(null);
	};


	//----------------------------------------------------------------
	/** 
	 * @func window.HALgetUserProfileResponse
	 * @desc HAL ユーザープロファイル取得の応答
	 * @param {void}
	 * @return {void}
	 */
	window.HALgetUserProfileResponse = function (res) {
		console.log('window.HALgetUserProfileResponse() res:', res);
		// 取得したトークンが有効かどうかを確認するために HAL ユーザープロファイルを取得
		if (inHALApiKey.value) {
			try {
				window.renewHALProfile(res.profile);
			} catch (error) {
				console.error(error);
				pSetHalApiTokenErr.textContent = error.message;
			}
		} else {
			inHALApiKey.value = "";  // undefined がテキストボックスに表示されないように
		}

		if (inHALApiKey.value && inHALApiKey.value != 'null' && res.profile) {  // API OK
			divHALArea.style.display = 'block';  // 同期ボタン表示
			spanHALinfo.style.display = 'block';
			spanHALsuggenst.style.display = 'none';
		} else {
			divHALArea.style.display = 'none';  // 同期ボタン表示
			spanHALinfo.style.display = 'none';
			spanHALsuggenst.style.display = 'block';
		}
	};


	//================================================================
	/** 
	 * @func btnQuestionnaireSubmit.addEventListener
	 * @desc local HAL, アンケート回答の投稿ボタンを押したときの処理
	 * @param {void}
	 * @return {void}
	 */
	btnQuestionnaireSubmit.addEventListener('click', function () {
		let submitData = window.getQuestionnaire();

		if (submitData != null) {
			// HAL にアンケート回答が POST される。
			window.ipc.HALsubmitQuestionnaire(submitData);
		}
	});

});

