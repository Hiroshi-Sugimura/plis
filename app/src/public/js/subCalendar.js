//////////////////////////////////////////////////////////////////////
//	Copyright (C) SUGIMURA Lab. 2022.08.30
//	Calendar関係の処理
//////////////////////////////////////////////////////////////////////
'use strict'


////////////////////////////////////////////////////////////////////////////////
// HTMLロードしたら準備
/**
 * @namespace subCalendar
 */
window.addEventListener('DOMContentLoaded', function () {
	console.dir('## DOMContentLoaded subCalendar.js');

	const week = ["日", "月", "火", "水", "木", "金", "土"];

	let holiday;  // 祝日データ
	let showDate; // 現在表示位置

	//----------------------------------------------------------------------------------------------
	/**
	 * @Func Window.createCalendar
	 * @Desc カレンダー初期作成
	 * @Param {Void}
	 * @Return {Void}
	 */
	window.createCalendar = function (_cal) {
		holiday = _cal;
		let today = new Date();
		showDate = new Date(today.getFullYear(), today.getMonth(), 1);  // 現在表示位置
		showProcess(today);
	};

	/**
	 * @Func Window.renewCalendar
	 * @Desc カレンダー日替わり処理などで更新する
	 * @Param {String} _cal 祝日データ(省略時は既存データを使用)
	 * @Return {Void}
	 */
	window.renewCalendar = function (_cal) {
		if (_cal) {
			holiday = _cal;
		}
		let today = new Date();
		showDate = new Date(today.getFullYear(), today.getMonth(), 1);  // 現在表示位置
		showProcess(today);
	};

	/**
	 * @func window.calendarPrev
	 * @desc 前の月表示ボタン
	 * @param {void}
	 * @return {void}
	 */
	window.calendarPrev = function () {
		// 月末だとずれる可能性があるため、1日固定で取得
		showDate.setMonth(showDate.getMonth() - 1);
		showProcess(showDate);
	};

	/**
	 * @func window.calendarNext
	 * @desc 次の月表示ボタン
	 * @param {void}
	 * @return {void}
	 */
	window.calendarNext = function () {
		// 月末だとずれる可能性があるため、1日固定で取得
		showDate.setMonth(showDate.getMonth() + 1);
		showProcess(showDate);
	};

	/**
	 * @func window.btnCalendarRenewSyukujitsu_Click
	 * @desc 祝日の再取得ボタン クリック
	 * @param {void}
	 * @return {void}
	 */
	window.btnCalendarRenewSyukujitsu_Click = function () {
		console.log('# btnCalendarRenewSyukujitsu_Click');
		window.ipc.CalendarRenewHolidays();  // 祝日データ再取得
	};


	/**
	 * @func
	 * @memberof subCalendar
	 * @desc 指定した日時のカレンダー表示
	 * @param date 日時
	 * @return {void}
	 */
	let weatherMap = {}; // その年月の天気データを保持

	/**
	 * @func
	 * @memberof subCalendar
	 * @desc 指定した日時のカレンダー表示
	 * @param date 日時
	 * @return {void}
	 */
	async function showProcess(date) {
		let year = date.getFullYear();
		let month = date.getMonth(); // 0始まり
		document.querySelector('#year_month').innerHTML = year + "年 " + (month + 1) + "月";

		try {
			// バックエンドから該当月の天気データを取得 (monthは0始まりのため+1して渡す)
			weatherMap = await window.ipc.CalendarGetWeather({ year: year, month: month + 1 });
		} catch (e) {
			console.error('Failed to get weather data:', e);
			weatherMap = {};
		}

		let calendar = createProcess(year, month);
		document.querySelector('#calendar').innerHTML = calendar;
	}

	/**
	 * @func
	 * @memberof subCalendar
	 * @desc カレンダー作成
	 * @param {void}
	 * @return {void}
	 */
	function createProcess(year, month) {
		// 曜日
		let calendar = "<table class='calendar'><tr class='dayOfWeek'>";
		for (let i = 0; i < week.length; i++) {
			calendar += "<th>" + week[i] + "</th>";
		}
		calendar += "</tr>";

		let count = 0;
		let startDayOfWeek = new Date(year, month, 1).getDay();
		let endDate = new Date(year, month + 1, 0).getDate();
		let lastMonthEndDate = new Date(year, month, 0).getDate();
		let row = Math.ceil((startDayOfWeek + endDate) / week.length);

		// 1行ずつ設定
		for (let i = 0; i < row; i++) {
			calendar += "<tr>";
			// 1colum単位で設定
			for (let j = 0; j < week.length; j++) {
				if (i == 0 && j < startDayOfWeek) {
					// 1行目で1日まで先月の日付を設定
					calendar += "<td class='disabled'>" + (lastMonthEndDate - startDayOfWeek + j + 1) + "</td>";
				} else if (count >= endDate) {
					// 最終行で最終日以降、翌月の日付を設定
					count++;
					calendar += "<td class='disabled'>" + (count - endDate) + "</td>";
				} else {
					// 当月の日付を曜日に照らし合わせて設定
					count++;
					let dateInfo = checkDate(year, month, count);
					
					// YYYY-MM-DD 形式の日付文字列を生成
					let dateStr = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(count).padStart(2, '0');
					let weatherHtml = '';
					
					if (weatherMap && weatherMap[dateStr]) {
						let w = weatherMap[dateStr];
						let iconClass = 'fa-question text-muted';
						let colorClass = '';
						if (w.icon === 'sunny') { iconClass = 'fa-sun'; colorClass = 'color: #ff9800;'; }
						else if (w.icon === 'cloudy') { iconClass = 'fa-cloud'; colorClass = 'color: #9e9e9e;'; }
						else if (w.icon === 'rainy') { iconClass = 'fa-cloud-showers-heavy'; colorClass = 'color: #2196f3;'; }
						else if (w.icon === 'snowy') { iconClass = 'fa-snowflake'; colorClass = 'color: #00bcd4;'; }

						weatherHtml = `<div class="cal-weather" onclick="window.showWeatherDetail('${dateStr}')" title="${w.weather} (詳細を表示)">`
							+ `<i class="fa-solid ${iconClass}" style="${colorClass}"></i>`
							+ `</div>`;
					}

					if (dateInfo.isToday) {
						calendar += "<td class='today'>" + count + weatherHtml + "</td>";
					} else if (dateInfo.isHoliday) {
						calendar += "<td class='holiday' title='" + dateInfo.holidayName + "'>" + count + weatherHtml + "</td>";
					} else {
						calendar += "<td>" + count + weatherHtml + "</td>";
					}
				}
			}
			calendar += "</tr>";
		}
		return calendar;
	}


	//////////////////////////////////////////////////////////////////////
	// 内部関数
	/**
	 * @func checkDate
	 * @memberof subCalendar
	 * @desc 日付チェック、createProcessで呼ばれる
	 * @param {void}
	 * @return {void}
	 */
	function checkDate(year, month, day) {
		if (isToday(year, month, day)) {
			return {
				isToday: true,
				isHoliday: false,
				holidayName: ""
			};
		}

		let checkHoliday = isHoliday(year, month, day);
		return {
			isToday: false,
			isHoliday: checkHoliday[0],
			holidayName: checkHoliday[1],
		};
	}

	/**
	 * @func isToday
	 * @memberof subCalendar
	 * @desc 当日かどうかcheckDateで呼ばれる
	 * @param {void}
	 * @return {void}
	 */
	function isToday(year, month, day) {
		let today = new Date();

		return (year == today.getFullYear()
			&& month == (today.getMonth())
			&& day == today.getDate());
	}

	/**
	 * @func isHoliday
	 * @memberof subCalendar
	 * @desc 祝日かどうかcheckDateで呼ばれる
	 * @param {void}
	 * @return {void}
	 */
	function isHoliday(year, month, day) {
		let checkDate = year + '/' + (month + 1) + '/' + day;
		// holidayデータのログは1回だけ出す（初回のみ）
		if (!window._holidayLogged) {
			window._holidayLogged = true;
			let dateList = holiday.split('\n').slice(1).map(row => {
				let cols = row.split(',');
				if (!cols[0] || !cols[1]) return null;
				let name = cols[1];
				try {
					name = decodeURIComponent(escape(name));
				} catch (e) {
					// 変換失敗時はそのまま
				}
				return { date: cols[0], name };
			}).filter(x => x);
			console.table(dateList);
		}
		let dateList = holiday.split('\n');
		// 1行目はヘッダーのため、初期値1で開始
		for (let i = 1; i < dateList.length; i++) {
			if (dateList[i].split(',')[0] === checkDate) {
				return [true, dateList[i].split(',')[1]];
			}
		}
		return [false, ""];
	}

	/**
	 * @func window.showWeatherDetail
	 * @desc 天気アイコンクリック時に詳細表示ダイアログを開く
	 * @param {string} dateStr 'YYYY-MM-DD'
	 */
	window.showWeatherDetail = function (dateStr) {
		if (!weatherMap || !weatherMap[dateStr]) return;
		let w = weatherMap[dateStr];
		let detail = w.detail;
		let dialog = document.getElementById('calendarWeatherDialog');
		let contents = document.getElementById('calendarWeatherContents');

		let typeText = w.type === 'forecast' ? '予報（予測値）' : '観測（実績値）';
		let sourceText = w.source === 'jma' ? '日本気象庁 (JMA)' : 'OpenWeatherMap (OWM)';

		let doc = `<h3>${dateStr} (${typeText})</h3>`;
		doc += `<p style="font-size:0.9em; color:var(--sub-text);">データ元: ${sourceText}</p>`;
		doc += `<table class="sort_table" style="width:100%; border-collapse:collapse; margin-top:10px;">`;
		doc += `<thead><tr><th style="padding:8px; border: 1px solid var(--accent); background-color: var(--sub-bg);">項目</th><th style="padding:8px; border: 1px solid var(--accent); background-color: var(--sub-bg);">値</th></tr></thead><tbody>`;

		doc += `<tr><td style="padding:8px; border:1px solid var(--accent);">天気状態</td><td style="padding:8px; border:1px solid var(--accent); font-weight:bold;">${w.weather}</td></tr>`;

		if (w.source === 'jma') {
			if (detail.publishingOffice) doc += `<tr><td style="padding:8px; border:1px solid var(--accent);">発表元</td><td style="padding:8px; border:1px solid var(--accent);">${detail.publishingOffice}</td></tr>`;
			if (detail.reportDatetime) doc += `<tr><td style="padding:8px; border:1px solid var(--accent);">発表日時</td><td style="padding:8px; border:1px solid var(--accent);">${detail.reportDatetime}</td></tr>`;
			if (detail.targetArea) doc += `<tr><td style="padding:8px; border:1px solid var(--accent);">対象エリア</td><td style="padding:8px; border:1px solid var(--accent);">${detail.targetArea}</td></tr>`;
			if (detail.wind) doc += `<tr><td style="padding:8px; border:1px solid var(--accent);">風の予報</td><td style="padding:8px; border:1px solid var(--accent);">${detail.wind}</td></tr>`;
			if (detail.wave) doc += `<tr><td style="padding:8px; border:1px solid var(--accent);">波の予報</td><td style="padding:8px; border:1px solid var(--accent);">${detail.wave}</td></tr>`;
			if (detail.note) doc += `<tr><td colspan="2" style="padding:8px; border:1px solid var(--accent); font-size:0.85em; color:gray; font-style:italic;">${detail.note}</td></tr>`;
		} else if (w.source === 'owm') {
			if (detail.place) doc += `<tr><td style="padding:8px; border:1px solid var(--accent);">観測地</td><td style="padding:8px; border:1px solid var(--accent);">${detail.place}</td></tr>`;
			if (detail.dateTime) doc += `<tr><td style="padding:8px; border:1px solid var(--accent);">観測日時</td><td style="padding:8px; border:1px solid var(--accent);">${detail.dateTime}</td></tr>`;
			if (detail.temp !== undefined) doc += `<tr><td style="padding:8px; border:1px solid var(--accent);">気温</td><td style="padding:8px; border:1px solid var(--accent);">${detail.temp} ℃</td></tr>`;
			if (detail.tempMax !== undefined) doc += `<tr><td style="padding:8px; border:1px solid var(--accent);">予想最高気温</td><td style="padding:8px; border:1px solid var(--accent);">${detail.tempMax} ℃</td></tr>`;
			if (detail.tempMin !== undefined) doc += `<tr><td style="padding:8px; border:1px solid var(--accent);">予想最低気温</td><td style="padding:8px; border:1px solid var(--accent);">${detail.tempMin} ℃</td></tr>`;
			if (detail.humidity !== undefined) doc += `<tr><td style="padding:8px; border:1px solid var(--accent);">湿度</td><td style="padding:8px; border:1px solid var(--accent);">${detail.humidity} %</td></tr>`;
			if (detail.pressure !== undefined) doc += `<tr><td style="padding:8px; border:1px solid var(--accent);">気圧</td><td style="padding:8px; border:1px solid var(--accent);">${detail.pressure} hPa</td></tr>`;
			if (detail.windSpeed !== undefined) doc += `<tr><td style="padding:8px; border:1px solid var(--accent);">風速</td><td style="padding:8px; border:1px solid var(--accent);">${detail.windSpeed} m/s</td></tr>`;
			if (detail.windDirection !== undefined) doc += `<tr><td style="padding:8px; border:1px solid var(--accent);">風向</td><td style="padding:8px; border:1px solid var(--accent);">${detail.windDirection} °</td></tr>`;
			if (detail.clouds !== undefined) doc += `<tr><td style="padding:8px; border:1px solid var(--accent);">雲量</td><td style="padding:8px; border:1px solid var(--accent);">${detail.clouds} %</td></tr>`;
		}

		doc += `</tbody></table>`;
		contents.innerHTML = doc;
		dialog.showModal();
	};

});
