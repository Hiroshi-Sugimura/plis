//////////////////////////////////////////////////////////////////////
//	Copyright (C) SUGIMURA Lab. 2022.08.30
//	Calendar関係の処理
//////////////////////////////////////////////////////////////////////
/**
 * @namespace subCalendar
 */
'use strict'


////////////////////////////////////////////////////////////////////////////////
// HTMLロードしたら準備
window.addEventListener('DOMContentLoaded', function () {
	console.dir('## DOMContentLoaded subCalendar.js');

	const week = ["日", "月", "火", "水", "木", "金", "土"];
	const today = new Date();
	// 月末だとずれる可能性があるため、1日固定で取得
	let showDate = new Date(today.getFullYear(), today.getMonth(), 1);

	let holiday;

	let btnCalendarRenewSyukujitsu   = document.getElementById('btnCalendarRenewSyukujitsu');  // カレンダーの祝日再取得


	//----------------------------------------------------------------------------------------------

	/** 
	 * @func window.renewCalendar
	 * @desc 祝日取得
	 * @param {void}
	 * @return {void}
	 */
	window.renewCalendar = function ( _cal ) {
		holiday = _cal;
		showProcess(today);
	};

	/** 
	 * @func window.calendarPrev
	 * @desc 前の月表示
	 * @param {void}
	 * @return {void}
	 */
	window.calendarPrev = function () {
		showDate.setMonth( showDate.getMonth() - 1 );
		showProcess(showDate);
	};

	/** 
	 * @func window.calendarNext
	 * @desc 次の月表示
	 * @param {void}
	 * @return {void}
	 */
	window.calendarNext = function () {
		showDate.setMonth(showDate.getMonth() + 1);
		showProcess(showDate);
	};

	/** 
	 * @func window.btnCalendarRenewSyukujitsu_Click
	 * @desc 祝日の再取得ボタンクリック
	 * @param {void}
	 * @return {void}
	 */
	window.btnCalendarRenewSyukujitsu_Click = function() {
		console.log('# btnCalendarRenewSyukujitsu_Click');
		window.ipc.CalendarRenewHolidays();  // 祝日データ再取得
	};


	/** 
	 * @func showProcess
	 * @desc カレンダー表示
	 * @param {void}
	 * @return {void}
	 */
	function showProcess(date) {
		let year = date.getFullYear();
		let month = date.getMonth(); // 0始まり
		document.querySelector('#year_month').innerHTML = year + "年 " + (month + 1) + "月";

		let calendar = createProcess(year, month);
		document.querySelector('#calendar').innerHTML = calendar;
	}

	/** 
	 * @func createProcess
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
					if(dateInfo.isToday){
						calendar += "<td class='today'>" + count + "</td>";
					} else if(dateInfo.isHoliday) {
						calendar += "<td class='holiday' title='" + dateInfo.holidayName + "'>" + count + "</td>";
					} else {
						calendar += "<td>" + count + "</td>";
					}
				}
			}
			calendar += "</tr>";
		}
		return calendar;
	}

	/** 
	 * @func checkDate
	 * @desc 日付チェック
	 * @param {void}
	 * @return {void}
	 */
	function checkDate(year, month, day) {
		if(isToday(year, month, day)){
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
	 * @desc 当日かどうか
	 * @param {void}
	 * @return {void}
	 */
	function isToday(year, month, day) {
		return (year == today.getFullYear()
				&& month == (today.getMonth())
				&& day == today.getDate());
	}

	/** 
	 * @func isHoliday
	 * @desc 祝日かどうか
	 * @param {void}
	 * @return {void}
	 */
	function isHoliday(year, month, day) {
		let checkDate = year + '/' + (month + 1) + '/' + day;
		let dateList = holiday.split('\n');
		// 1行目はヘッダーのため、初期値1で開始
		for (let i = 1; i < dateList.length; i++) {
			if (dateList[i].split(',')[0] === checkDate) {
				return [true, dateList[i].split(',')[1]];
			}
		}
		return [false, ""];
	}

} );
