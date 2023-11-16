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
		if (!arg) {
			console.log('window.showGarminData() is no show. arg:', arg);
			divGarmin.innerHTML = '<div class="p">No data.</div>';
			return;
		}
		console.log('window.showGarminData() arg:', arg);

		let doc = '';

		doc += getActivitiesHtml(arg.Activities);
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
			doc += `<div class="p"><table><thead><tr><th>Key</th><th>Value</th></tr></thead><tbody>
			<tr><td>startTimeInSeconds</td><td>${data.startTimeInSeconds}</td>
			<tr><td>startTimeOffsetInSeconds</td><td>${data.startTimeOffsetInSeconds}</td>
			<tr><td>activityType</td><td>${data.activityType}</td>
			<tr><td>averageHeartRateInBeatsPerMinute</td><td>${data.averageHeartRateInBeatsPerMinute}</td>
			<tr><td>averageRunCadenceInStepsPerMinute</td><td>${data.averageRunCadenceInStepsPerMinute}</td>
			<tr><td>averageSpeedInMetersPerSecond</td><td>${data.averageSpeedInMetersPerSecond}</td>
			<tr><td>averagePaceInMinutesPerKilometer</td><td>${data.averagePaceInMinutesPerKilometer}</td>
			<tr><td>activeKilocalories</td><td>${data.activeKilocalories}</td>
			<tr><td>deviceName</td><td>${data.deviceName}</td>
			<tr><td>distanceInMeters</td><td>${data.distanceInMeters}</td>
			<tr><td>maxHeartRateInBeatsPerMinute</td><td>${data.maxHeartRateInBeatsPerMinute}</td>
			<tr><td>maxPaceInMinutesPerKilometer</td><td>${data.maxPaceInMinutesPerKilometer}</td>
			<tr><td>maxRunCadenceInStepsPerMinute</td><td>${data.maxRunCadenceInStepsPerMinute}</td>
			<tr><td>maxSpeedInMetersPerSecond</td><td>${data.maxSpeedInMetersPerSecond}</td>
			<tr><td>steps</td><td>${data.steps}</td>
			</tbody></table></div>`
		} else {
			doc += `<div class='p'>No data</div>`
		}

		return doc;
	};

	let getActivityDetailsHtml = function (data) {
		let doc = '<h3>Activity Details</h3>';
		if (data) {
			doc += `<div class="p"><table>
			<tr><td>summary</td><td>${JSON.stringify(JSON.parse(data.summary), 1, '<br>')}</td>
			<tr><td>samples</td><td>${data.samples}</td>
			<tr><td>laps</td><td>${data.laps}</td>
			</table></div>`
		} else {
			doc += `<div class='p'>No data</div>`
		}
		return doc;
	};

	let getBodyCompsHtml = function (data) {
		let doc = '<h3>Body Comps</h3>';
		if (data) {
			doc += `<div class="p"><table>
			<tr><td>muscleMassInGrams</td><td>${data.muscleMassInGrams}</td>
			<tr><td>boneMassInGrams</td><td>${data.boneMassInGrams}</td>
			<tr><td>bodyWaterInPercent</td><td>${data.bodyWaterInPercent}</td>
			<tr><td>bodyFatInPercent</td><td>${data.bodyFatInPercent}</td>
			<tr><td>bodyMassIndex</td><td>${data.bodyMassIndex}</td>
			<tr><td>weightInGrams</td><td>${data.weightInGrams}</td>
			<tr><td>measurementTimeInSeconds</td><td>${data.measurementTimeInSeconds}</td>
			<tr><td>measurementTimeOffsetInSeconds</td><td>${data.measurementTimeOffsetInSeconds}</td>
			</table></div>`
		} else {
			doc += `<div class='p'>No data</div>`
		}
		return doc;
	};

	let getDailiesHtml = function (data) {
		let doc = '<h3>Dailies</h3>';
		if (data) {
			doc += `<div class="p"><table>
			<tr><td>calendarDate</td><td>${data.calendarDate}</td>
			<tr><td>startTimeInSeconds</td><td>${data.startTimeInSeconds}</td>
			<tr><td>startTimeOffsetInSeconds</td><td>${data.startTimeOffsetInSeconds}</td>
			<tr><td>activityType</td><td>${data.activityType}</td>
			<tr><td>durationInSeconds</td><td>${data.durationInSeconds}</td>
			<tr><td>steps</td><td>${data.steps}</td>
			<tr><td>distanceInMeters</td><td>${data.distanceInMeters}</td>
			<tr><td>activeTimeInSeconds</td><td>${data.activeTimeInSeconds}</td>
			<tr><td>activeKilocalories</td><td>${data.activeKilocalories}</td>
			<tr><td>bmrKilocalories</td><td>${data.bmrKilocalories}</td>
			<tr><td>cunsumedCalories</td><td>${data.cunsumedCalories}</td>
			<tr><td>moderateIntensityDurationInSeconds</td><td>${data.moderateIntensityDurationInSeconds}</td>
			<tr><td>vigorousIntensityDurationInSeconds</td><td>${data.vigorousIntensityDurationInSeconds}</td>
			<tr><td>floorsClimbed</td><td>${data.floorsClimbed}</td>
			<tr><td>minHeartRateInBeatsPerMinute</td><td>${data.minHeartRateInBeatsPerMinute}</td>
			<tr><td>averageHeartRateInBeatsPerMinute</td><td>${data.averageHeartRateInBeatsPerMinute}</td>
			<tr><td>maxHeartRateInBeatsPerMinute</td><td>${data.maxHeartRateInBeatsPerMinute}</td>
			<tr><td>restingHeartRateInBeatsPerMinute</td><td>${data.restingHeartRateInBeatsPerMinute}</td>
			<tr><td>timeOffsetHeartRateSamples</td><td>${data.timeOffsetHeartRateSamples}</td>
			<tr><td>averageStressLevel</td><td>${data.averageStressLevel}</td>
			<tr><td>maxStressLevel</td><td>${data.maxStressLevel}</td>
			<tr><td>stressDurationInSeconds</td><td>${data.stressDurationInSeconds}</td>
			<tr><td>restStressDurationInSeconds</td><td>${data.restStressDurationInSeconds}</td>
			<tr><td>activityStressDurationInSeconds</td><td>${data.activityStressDurationInSeconds}</td>
			<tr><td>lowStressDurationInSeconds</td><td>${data.lowStressDurationInSeconds}</td>
			<tr><td>mediumStressDurationInSeconds</td><td>${data.mediumStressDurationInSeconds}</td>
			<tr><td>highStressDurationInSeconds</td><td>${data.highStressDurationInSeconds}</td>
			<tr><td>stressQualifier</td><td>${data.stressQualifier}</td>
			<tr><td>stepsGoal</td><td>${data.stepsGoal}</td>
			<tr><td>stepsGoal</td><td>${data.stepsGoal}</td>
			<tr><td>intensityDurationGoalInSeconds</td><td>${data.intensityDurationGoalInSeconds}</td>
			<tr><td>floorsClimbedGoal</td><td>${data.floorsClimbedGoal}</td>
			</table></div>`
		} else {
			doc += `<div class='p'>No data</div>`
		}
		return doc;
	};

	let getEpochsHtml = function (data) {
		let doc = '<h3>Epochs</h3>';
		if (data) {
			doc += `<div class="p"><table>
			<tr><td>startTimeInSeconds</td><td>${data.startTimeInSeconds}</td>
			<tr><td>startTimeOffsetInSeconds</td><td>${data.startTimeOffsetInSeconds}</td>
			<tr><td>activityType</td><td>${data.activityType}</td>
			<tr><td>durationInSeconds</td><td>${data.durationInSeconds}</td>
			<tr><td>activeTimeInSeconds</td><td>${data.activeTimeInSeconds}</td>
			<tr><td>steps</td><td>${data.steps}</td>
			<tr><td>distanceInMeters</td><td>${data.distanceInMeters}</td>
			<tr><td>activeKilocalories</td><td>${data.activeKilocalories}</td>
			<tr><td>met</td><td>${data.met}</td>
			<tr><td>intensity</td><td>${data.intensity}</td>
			<tr><td>meanMotionIntensity</td><td>${data.meanMotionIntensity}</td>
			<tr><td>maxMotionIntensity</td><td>${data.maxMotionIntensity}</td>
			</table></div>`
		} else {
			doc += `<div class='p'>No data</div>`
		}
		return doc;
	};

	let getMoveIQActivitiesHtml = function (data) {
		let doc = '<h3>MoveIQActivities</h3>';
		if (data) {
			doc += `<div class="p"><table>
			<tr><td>calendarDate</td><td>${data.calendarDate}</td>
			<tr><td>startTimeInSeconds</td><td>${data.startTimeInSeconds}</td>
			<tr><td>offsetInSeconds</td><td>${data.offsetInSeconds}</td>
			<tr><td>durationInSeconds</td><td>${data.durationInSeconds}</td>
			<tr><td>activityType</td><td>${data.activityType}</td>
			<tr><td>activitySubType</td><td>${data.activitySubType}</td>
			</table></div>`
		} else {
			doc += `<div class='p'>No data</div>`
		}
		return doc;
	};

	let getPulseoxHtml = function (data) {
		let doc = '<h3>Pulseox</h3>';
		if (data) {
			doc += `<div class="p"><table>
			<tr><td>calendarDate</td><td>${data.calendarDate}</td>
			<tr><td>startTimeInSeconds</td><td>${data.startTimeInSeconds}</td>
			<tr><td>durationInSeconds</td><td>${data.durationInSeconds}</td>
			<tr><td>startTimeOffsetInSeconds</td><td>${data.startTimeOffsetInSeconds}</td>
			<tr><td>timeOffsetSpo2Values</td><td>${data.timeOffsetSpo2Values}</td>
			<tr><td>onDemand</td><td>${data.onDemand}</td>
			</table></div>`
		} else {
			doc += `<div class='p'>No data</div>`
		}
		return doc;
	};

	let getSleepsHtml = function (data) {
		let doc = '<h3>Sleeps</h3>';
		if (data) {
			doc += `<div class="p"><table>
			<tr><td>calendarDate</td><td>${data.calendarDate}</td>
			<tr><td>startTimeInSeconds</td><td>${data.startTimeInSeconds}</td>
			<tr><td>startTimeOffsetInSeconds</td><td>${data.startTimeOffsetInSeconds}</td>
			<tr><td>durationInSeconds</td><td>${data.durationInSeconds}</td>
			<tr><td>unmeasurableSleepInSeconds</td><td>${data.unmeasurableSleepInSeconds}</td>
			<tr><td>deepSleepDurationInSeconds</td><td>${data.deepSleepDurationInSeconds}</td>
			<tr><td>lightSleepDurationInSeconds</td><td>${data.lightSleepDurationInSeconds}</td>
			<tr><td>remSleepInSeconds</td><td>${data.remSleepInSeconds}</td>
			<tr><td>awakeDurationInSeconds</td><td>${data.awakeDurationInSeconds}</td>
			<tr><td>sleepLevelsMap</td><td>${data.sleepLevelsMap}</td>
			<tr><td>validation</td><td>${data.validation}</td>
			<tr><td>timeOffsetSleepRespiration</td><td>${data.timeOffsetSleepRespiration}</td>
			<tr><td>timeOffsetSleepSpo2</td><td>${data.timeOffsetSleepSpo2}</td>
			<tr><td>overallSleepScore</td><td>${data.overallSleepScore}</td>
			<tr><td>sleepScores</td><td>${data.sleepScores}</td>
			</table></div>`
		} else {
			doc += `<div class='p'>No data</div>`
		}
		return doc;
	};

	let getStressDetailsHtml = function (data) {
		let doc = '<h3>StressDetails</h3>';
		if (data) {
			doc += `<div class="p"><table><tr><td></td><td>${JSON.stringify(data, 1, '<br>')}</td></table></div>`
		} else {
			doc += `<div class='p'>No data</div>`
		}
		return doc;
	};

	let getUserMetricsHtml = function (data) {
		let doc = '<h3>UserMetrics</h3>';
		if (data) {
			doc += `<div class="p"><table>
			<tr><td>calendarDate</td><td>${data.calendarDate}</td>
			<tr><td>vo2Max</td><td>${data.vo2Max}</td>
			<tr><td>fitnessAge</td><td>${data.fitnessAge}</td>
			</table></div>`
		} else {
			doc += `<div class='p'>No data</div>`
		}
		return doc;
	};

});
