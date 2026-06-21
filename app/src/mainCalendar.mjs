//////////////////////////////////////////////////////////////////////
//	Copyright (C) Hiroshi SUGIMURA 2020.10.30
//////////////////////////////////////////////////////////////////////
/**
 * @module mainCalendar
 * @description Calendar management module for PLIS.
 * Handles holiday data fetching from Japan's Cabinet Office and manages
 * calendar synchronization with the renderer process.
 */
// 'use strict'

//////////////////////////////////////////////////////////////////////
// 基本ライブラリ
import { fileURLToPath } from "node:url";
import path from 'node:path';
import fs from 'fs';
import axios from 'axios';
import { store } from './storeSingleton.mjs';
import { logger } from './logger.mjs';
import cron from 'node-cron';
import { mergeDeeply } from './mainSubmodule.mjs';
import { mainJma } from './mainJma.mjs';
import { mainOwm } from './mainOwm.mjs';
import localDB from './models/localDBModels.mjs';
const { weatherModel, weatherForecastModel } = localDB;
import { Op } from 'sequelize';


// const store = new Store();

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

//////////////////////////////////////////////////////////////////////
const appname = 'PLIS';
const isWin = process.platform == "win32" ? true : false;
const userHome = process.env[isWin ? "USERPROFILE" : "HOME"];
const databaseDir = path.join(userHome, appname);  // SQLite3ファイルの置き場


let config = {
	debug: false
}

/**
 * @typedef {Object} CalendarConfig
 * @property {boolean} [debug=false] デバッグログを出すかどうか
 */

/**
 * @typedef {Object} CalendarPersist
 * @description 将来的な拡張用。現在は祝日CSVのキャッシュなどを想定。
 */

/** @type {CalendarPersist} */
let persist = {};


//////////////////////////////////////////////////////////////////////
// メッセージ管理
let sendIPCMessage = null;

/**
 * @module mainCalendar
 * @desc カレンダーオブジェクト
 */
let mainCalendar = {
	isRun: false,  // 多重起動防止
	holidayData: null,  // 祝日データ
	holidaysURL: 'https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv', // 内閣府からダウンロードする祝日ファイルのURI
	observationTask: null,  // cronオブジェクト

	//////////////////////////////////////////////////////////////////////
	// interfaces
	/**
	 * 初期化して監視を開始する。
	 * - 祝日CSVが無ければダウンロード
	 * - Rendererへカレンダーデータを送信
	 * - 毎日0:00に更新イベントを発火
	 * @param {(channel:string, ...args:any[])=>void} _sendIPCMessage IPCへメッセージを送る関数
	 * @returns {void}
	 */
	start: function (_sendIPCMessage) {
		sendIPCMessage = _sendIPCMessage;

		config.debug = store.get('config.Calendar.debug', false);

		logger.debug('mainCalendar', config.debug, 'start()');

		if (mainCalendar.isRun) {
			sendIPCMessage('createCalendar', mainCalendar.holidayData);  // re-rentry
			return;
		}
		mainCalendar.isRun = true;

		// 祝日データの確認
		fs.readFile(path.join(databaseDir, "syukujitsu.csv"), "utf-8", (err, data) => {
			if (err) {
				logger.error('mainCalendar', `syukujitsu.csv is NOT found. error: ${err.message}`);
				mainCalendar.getHolidays();  // カレンダーデータ無いから取得する
				return;
			}
			mainCalendar.holidayData = data;
			sendIPCMessage('createCalendar', mainCalendar.holidayData);
		});


		// 日替わりでカレンダー更新
		mainCalendar.observationTask = cron.schedule('0 0 * * *', async () => { // 毎日0時0分
			try {
				logger.debug('mainCalendar', config.debug, 'start() observationTask');
				sendIPCMessage('renewCalendar');
			} catch (error) {
				logger.error('mainCalendar', 'observationTask error:', error);
			}
		});

		mainCalendar.observationTask.start();
	},

	/**
	 * 保存せずに停止し、監視を解除する。
	 * @returns {void}
	 */
	stopWithoutSave: function () {
		logger.debug('mainCalendar', config.debug, 'stop()');

		if (mainCalendar.observationTask) {
			mainCalendar.observationTask.stop();
			mainCalendar.observationTask = null;
			logger.debug('mainCalendar', config.debug, 'stopObserve() is stopped.');
		} else {
			logger.debug('mainCalendar', config.debug, 'stopObserve() has already stopped.');
		}

		mainCalendar.isRun = false;
	},


	/**
	 * 設定をマージして保存する。_configがnull/undefinedの場合は現状を保存のみ。
	 * @param {Partial<CalendarConfig>=} _config 上書きする設定
	 * @returns {Promise<void>}
	 */
	setConfig: async function (_config) {
		if (_config) {
			config = mergeDeeply(config, _config);
		}
		await store.set('config.Calendar', config);
		sendIPCMessage("renewCalendarConfigView", config);
		sendIPCMessage("configSaved", 'Calendar');  // 保存したので画面に通知
	},

	/**
	 * 現在の設定値を返す。
	 * @returns {CalendarConfig}
	 */
	getConfig: function () {
		return config;
	},

	/**
	 * 現在の永続データを返す。
	 * @returns {CalendarPersist}
	 */
	getPersist: function () {
		return persist;
	},


	//////////////////////////////////////////////////////////////////////
	// 内部関数
	/**
	 * 祝日データを内閣府サイトから取得し、ユーザフォルダに syukujitsu.csv として保存する。
	 * 成功時は Renderer に renewCalendar を送信する。
	 * @returns {void}
	 */
	getHolidays: function () {
		logger.debug('mainCalendar', config.debug, 'getHolidays()');

		axios.get(mainCalendar.holidaysURL).then((res) => {
			const csv = res.data;
			// ディレクトリが存在しない場合は作成
			if (!fs.existsSync(databaseDir)) {
				fs.mkdirSync(databaseDir, { recursive: true });
			}
			fs.writeFile(path.join(databaseDir, "syukujitsu.csv"), csv, (err) => {
				if (err) {
					logger.error('mainCalendar', `getHolidays() syukujitsu.csv is NOT saved. error: ${err.message}`);
					return;
				}
				sendIPCMessage('renewCalendar', csv);
			});
		}).catch((error) => {
			if (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT' || error.code === 'ENETUNREACH' || error.code === 'ECONNABORTED' || error.code === 'EHOSTUNREACH' || error.code === 'ECONNRESET') {
				logger.error('mainCalendar', `getHolidays() Connection Error: ${error.code}`);
			} else {
				logger.error('mainCalendar', 'getHolidays() error:', error);
			}
		});
	},

	/**
	 * 指定年月の天気データを収集する。
	 * @param {number} year 年
	 * @param {number} month 月 (1-12)
	 * @returns {Promise<Object.<string, any>>} 日付文字列をキーとする天気データのマッピング
	 */
	getWeatherData: async function (year, month) {
		logger.debug('mainCalendar', config.debug, `getWeatherData() year:${year}, month:${month}`);
		let weatherMap = {};

		// JMA & OWM の設定を取得
		let jmaConfig = mainJma.getConfig();
		let owmConfig = mainOwm.getConfig();

		// ソース判定
		let source = 'none';
		if (jmaConfig.enabled && owmConfig.enabled) {
			let isOverseas = false;
			if (owmConfig.zipcode) {
				let parts = owmConfig.zipcode.split(',');
				if (parts.length > 1 && parts[1].trim().toLowerCase() !== 'jp') {
					isOverseas = true;
				}
			}
			source = isOverseas ? 'owm' : 'jma';
		} else if (owmConfig.enabled) {
			source = 'owm';
		} else if (jmaConfig.enabled) {
			source = 'jma';
		}

		if (source === 'none') {
			return weatherMap;
		}

		// カレンダー表示領域を考慮して前月20日〜翌月15日までクエリ
		let startDate = new Date(year, month - 2, 20);
		let endDate = new Date(year, month, 15);
		
		let today = new Date();
		today.setHours(0, 0, 0, 0);

		let cur = new Date(startDate);
		while (cur <= endDate) {
			let dateStr = cur.getFullYear() + '-' + String(cur.getMonth() + 1).padStart(2, '0') + '-' + String(cur.getDate()).padStart(2, '0');
			let isFuture = cur.getTime() >= today.getTime();

			if (source === 'jma') {
				if (isFuture) {
					try {
						let latestForecast = await weatherForecastModel.findOne({
							where: { targetArea: jmaConfig.area },
							order: [['createdAt', 'DESC']]
						});
						if (latestForecast) {
							let timeDefines = JSON.parse(latestForecast.timeDefines);
							let weathers = JSON.parse(latestForecast.weathers);
							let weatherCodes = JSON.parse(latestForecast.weatherCodes);
							
							let idx = timeDefines.findIndex(t => t.startsWith(dateStr));
							if (idx !== -1) {
								let weatherText = weathers[idx];
								let code = weatherCodes[idx];
								weatherMap[dateStr] = {
									type: 'forecast',
									source: 'jma',
									weather: weatherText,
									icon: mainCalendar.mapJmaIcon(code, weatherText),
									detail: {
										publishingOffice: latestForecast.publishingOffice,
										reportDatetime: latestForecast.reportDatetime,
										targetArea: latestForecast.targetArea,
										weather: weatherText,
										wind: JSON.parse(latestForecast.winds)[idx] || '',
										wave: JSON.parse(latestForecast.waves)[idx] || ''
									}
								};
							}
						}
					} catch (e) {
						logger.error('mainCalendar', 'getWeatherData JMA forecast error:', e);
					}
				} else {
					try {
						let pastForecast = await weatherForecastModel.findOne({
							where: {
								targetArea: jmaConfig.area,
								timeDefines: { [Op.like]: `%${dateStr}%` }
							},
							order: [['createdAt', 'DESC']]
						});
						if (pastForecast) {
							let timeDefines = JSON.parse(pastForecast.timeDefines);
							let weathers = JSON.parse(pastForecast.weathers);
							let weatherCodes = JSON.parse(pastForecast.weatherCodes);
							let idx = timeDefines.findIndex(t => t.startsWith(dateStr));
							if (idx !== -1) {
								let weatherText = weathers[idx];
								let code = weatherCodes[idx];
								weatherMap[dateStr] = {
									type: 'actual',
									source: 'jma',
									weather: weatherText,
									icon: mainCalendar.mapJmaIcon(code, weatherText),
									detail: {
										publishingOffice: pastForecast.publishingOffice,
										reportDatetime: pastForecast.reportDatetime,
										targetArea: pastForecast.targetArea,
										weather: weatherText,
										wind: JSON.parse(pastForecast.winds)[idx] || '',
										wave: JSON.parse(pastForecast.waves)[idx] || '',
										note: '※この日の実績値の代わりに、当時発表された予報履歴データを表示しています。'
									}
								};
							}
						}
					} catch (e) {
						logger.error('mainCalendar', 'getWeatherData JMA actual error:', e);
					}
				}
			} else if (source === 'owm') {
				if (isFuture) {
					let owmPersist = mainOwm.getPersist();
					if (owmPersist && owmPersist.forecast && owmPersist.forecast.list) {
						let slots = owmPersist.forecast.list.filter(item => item.dt_txt.startsWith(dateStr));
						if (slots.length > 0) {
							let targetSlot = slots.find(item => item.dt_txt.includes('12:00:00')) || slots[Math.floor(slots.length / 2)];
							let weatherObj = targetSlot.weather[0];
							weatherMap[dateStr] = {
								type: 'forecast',
								source: 'owm',
								weather: weatherObj.main + ` (${weatherObj.description})`,
								icon: mainCalendar.mapOwmIcon(weatherObj.main),
								detail: {
									place: owmPersist.forecast.city.name,
									weather: weatherObj.main,
									description: weatherObj.description,
									temp: targetSlot.main.temp,
									tempMax: targetSlot.main.temp_max,
									tempMin: targetSlot.main.temp_min,
									humidity: targetSlot.main.humidity,
									pressure: targetSlot.main.pressure,
									windSpeed: targetSlot.wind.speed,
									clouds: targetSlot.clouds.all
								}
							};
						}
					}
				} else {
					try {
						let startOfDay = dateStr + ' 00:00:00';
						let endOfDay = dateStr + ' 23:59:59';
						let records = await weatherModel.findAll({
							where: {
								srcType: 'owm',
								dateTime: { [Op.between]: [startOfDay, endOfDay] }
							},
							order: [['dateTime', 'ASC']]
						});

						if (records && records.length > 0) {
							let targetRecord = records[0];
							let minDiff = Infinity;
							for (let r of records) {
								let rTime = new Date(r.dateTime).getHours();
								let diff = Math.abs(rTime - 12);
								if (diff < minDiff) {
									minDiff = diff;
									targetRecord = r;
								}
							}

							weatherMap[dateStr] = {
								type: 'actual',
								source: 'owm',
								weather: targetRecord.weather,
								icon: mainCalendar.mapOwmIcon(targetRecord.weather),
								detail: {
									dateTime: targetRecord.dateTime,
									place: targetRecord.place,
									weather: targetRecord.weather,
									temp: targetRecord.temperature,
									humidity: targetRecord.humidity,
									pressure: targetRecord.pressure,
									windSpeed: targetRecord.windSpeed,
									windDirection: targetRecord.windDirection,
									clouds: targetRecord.cloudCover
								}
							};
						}
					} catch (e) {
						logger.error('mainCalendar', 'getWeatherData OWM actual error:', e);
					}
				}
			}

			cur.setDate(cur.getDate() + 1);
		}

		return weatherMap;
	},

	/**
	 * JMA天気コード・文字列からアイコンタイプへのマッピング
	 */
	mapJmaIcon: function (code, text) {
		if (!code) {
			if (!text) return 'unknown';
			if (text.includes('晴')) return 'sunny';
			if (text.includes('雨')) return 'rainy';
			if (text.includes('雪')) return 'snowy';
			if (text.includes('曇') || text.includes('くもり')) return 'cloudy';
			return 'unknown';
		}
		
		let c = parseInt(code);
		if (c >= 100 && c < 200) return 'sunny';
		if (c >= 200 && c < 300) return 'cloudy';
		if (c >= 300 && c < 400) return 'rainy';
		if (c >= 400 && c < 500) return 'snowy';
		return 'unknown';
	},

	/**
	 * OWM天気文字列からアイコンタイプへのマッピング
	 */
	mapOwmIcon: function (weather) {
		if (!weather) return 'unknown';
		let w = weather.toLowerCase();
		if (w.includes('clear') || w.includes('sunny')) return 'sunny';
		if (w.includes('cloud') || w.includes('mist') || w.includes('haze') || w.includes('fog')) return 'cloudy';
		if (w.includes('rain') || w.includes('drizzle') || w.includes('thunderstorm')) return 'rainy';
		if (w.includes('snow')) return 'snowy';
		return 'unknown';
	}

};


// module.exports = mainCalendar;
export { mainCalendar };
//////////////////////////////////////////////////////////////////////
// EOF
//////////////////////////////////////////////////////////////////////
