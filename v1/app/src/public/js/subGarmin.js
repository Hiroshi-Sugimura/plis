//////////////////////////////////////////////////////////////////////
//	Copyright (C) SUGIMURA Lab. 2023.10.08
//	Garmin関係の処理
//////////////////////////////////////////////////////////////////////
'use strict'


////////////////////////////////////////////////////////////////////////////////
// HTMLロードしたら準備
/**
 * @namespace subGarmin
 */
window.addEventListener('DOMContentLoaded', function () {
	console.dir('## DOMContentLoaded subGarmin.js');

	//----------------------------------------------------------------------------------------------
	// デバイス情報のrenew
	let stateGarmin;  // リスト Garmin

	let divGarmin = document.getElementById('divGarmin'); // contents

	/** 
	 * @func window.showGarminData
	 * @desc mainからの情報で，Garmin関係のhtmlを変更する
	 * @param {void}
	 * @return {void}
	 */
	window.showGarminData = function (arg) { // stateGarmin = json = arg;
		stateGarmin = arg;
		console.log('window.showGarminData() arg:', arg);

		let doc = '';

		doc += getActivitiesHtml(arg.getActivitiesHtml);
		doc += getActivityDetailsHtml(arg.ActivityDetails);
		doc += getBodyCompsHtml(arg.BodyComps);
		doc += getDailiesHtml(arg.Dailies);
		doc += getEpochsHtml(arg.Epochs);
		doc += getMoveIQActivitiesHtml(arg.MoveIQActivities);
		doc += getPulseoxHtml(arg.Pulseox);
		doc += getSleepsHtml(arg.Sleeps);
		doc += getStressDetailsHtml(arg.StressDetailsa);
		doc += getUserMetricsHtml(arg.UserMetrics);

		divGarmin.innerHTML = doc;
	};

	//----------------------------------------------------------------------------------------------
	// inner function
	let getActivitiesHtml = function (data) {
		let doc = '<h3>Activities</h3>';
		if (data) {
			doc += `<table><tr><td></td><td>${JSON.stringify(data, 1, '<br>')}</td ></table > `
		} else {
			doc += `<div class='p'>No data</div>`
		}

		return doc;
	};

	let getActivityDetailsHtml = function (data) {
		let doc = '<h3>Activity Details</h3>';
		if (data) {
			doc += `<table><tr><td></td><td>${JSON.stringify(data, 1, '<br>')}</td></table>`
		} else {
			doc += `<div class='p'>No data</div>`
		}
		return doc;
	};

	let getBodyCompsHtml = function (data) {
		let doc = '<h3>Body Comps</h3>';
		if (data) {
			doc += `<table><tr><td></td><td>${JSON.stringify(data, 1, '<br>')}</td></table>`
		} else {
			doc += `<div class='p'>No data</div>`
		}
		return doc;
	};

	let getDailiesHtml = function (data) {
		let doc = '<h3>Dailies</h3>';
		if (data) {
			doc += `<table><tr><td></td><td>${JSON.stringify(data, 1, '<br>')}</td></table>`
		} else {
			doc += `<div class='p'>No data</div>`
		}
		return doc;
	};

	let getEpochsHtml = function (data) {
		let doc = '<h3>Epochs</h3>';
		if (data) {
			doc += `<table><tr><td></td><td>${JSON.stringify(data, 1, '<br>')}</td></table>`
		} else {
			doc += `<div class='p'>No data</div>`
		}
		return doc;
	};

	let getMoveIQActivitiesHtml = function (data) {
		let doc = '<h3>MoveIQActivities</h3>';
		if (data) {
			doc += `<table><tr><td></td><td>${JSON.stringify(data, 1, '<br>')}</td></table>`
		} else {
			doc += `<div class='p'>No data</div>`
		}
		return doc;
	};

	let getPulseoxHtml = function (data) {
		let doc = '<h3>Pulseox</h3>';
		if (data) {
			doc += `<table><tr><td></td><td>${JSON.stringify(data, 1, '<br>')}</td></table>`
		} else {
			doc += `<div class='p'>No data</div>`
		}
		return doc;
	};

	let getSleepsHtml = function (data) {
		let doc = '<h3>Sleeps</h3>';
		if (data) {
			doc += `<table><tr><td></td><td>${JSON.stringify(data, 1, '<br>')}</td></table>`
		} else {
			doc += `<div class='p'>No data</div>`
		}
		return doc;
	};

	let getStressDetailsHtml = function (data) {
		let doc = '<h3>StressDetails</h3>';
		if (data) {
			doc += `<table><tr><td></td><td>${JSON.stringify(data, 1, '<br>')}</td></table>`
		} else {
			doc += `<div class='p'>No data</div>`
		}
		return doc;
	};

	let getUserMetricsHtml = function (data) {
		let doc = '<h3>UserMetrics</h3>';
		if (data) {
			doc += `<table><tr><td></td><td>${JSON.stringify(data, 1, '<br>')}</td></table>`
		} else {
			doc += `<div class='p'>No data</div>`
		}
		return doc;
	};

});
