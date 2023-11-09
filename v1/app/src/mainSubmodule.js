//////////////////////////////////////////////////////////////////////
//	Copyright (C) Hiroshi SUGIMURA 2022.09.06
//////////////////////////////////////////////////////////////////////
/**
 * @module mainSubmodule
 */
'use strict'

//////////////////////////////////////////////////////////////////////
// 基本ライブラリ


//////////////////////////////////////////////////////////////////////
/**
 *  @func objectSort
 *  @desc キーでソートしてからJSONにする
 *  @param {Object} [obj]
 *  @return {map}
 */
// キーでソートしてからJSONにする
// 単純にJSONで比較するとオブジェクトの格納順序の違いだけで比較結果がイコールにならない
let objectSort = function (obj) {
	let keys = Object.keys(obj).sort();
	let map = {};
	keys.forEach(function (key) {
		map[key] = obj[key];
	});

	return map;
};

/**
 *  @func getNow
 *  @desc 現在時刻 ("YYYY-MM-DD hh:mm:ss")
 *  @param {void}
 *  @return {String} time
 */
let getNow = function () {
	let now = new Date();

	// 日付
	let date = [
		now.getFullYear().toString(),
		('0' + (now.getMonth() + 1)).slice(-2),
		('0' + now.getDate()).slice(-2)
	].join('-');

	// 時刻
	let time = [
		('0' + now.getHours()).slice(-2),
		('0' + now.getMinutes()).slice(-2),
		('0' + now.getSeconds()).slice(-2)
	].join(':');

	return date + ' ' + time;
}

/**
 *  @func getToday
 *  @desc 今日の日付 ("YYYY-MM-DD")
 *  @param {void}
 *  @return {String} time
 */
let getToday = function () {
	return Date.today().toFormat("YYYY-MM-DD");
};

/**
 *  @func getYesterday
 *  @desc 昨日の日付 ("YYYY-MM-DD")
 *  @param {void}
 *  @return {String} time
 */
let getYesterday = function () {
	return Date.yesterday().toFormat("YYYY-MM-DD");
};


/**
 *  @func isObjEmpty
 *  @desc Object型が空{}かどうかチェックする。Object型は == {} ではチェックできない。
 *  @param {Object} obj
 *  @return {Object} obj
 */
let isObjEmpty = function (obj) {
	return Object.keys(obj).length === 0;
}


/**
 *  @func mergeDeeply
 *  @param {target} target
 *  @param {source} source
 *  @param {opts} opts
 *  @return {Object} obj
 *  @desc 深いマージを実現する。
 *  target: マージ対象かつマージ先
 *  source: マージ対象
 *  opts: 配列の取り扱い
 *  配列の要素（中身）は結合(concat)したい場合、以下のようにして、さっきの関数を呼び出してやればOK
 *  opts = {concatArray: true}
 */
let mergeDeeply = function (target, source, opts) {
	const isObject = obj => obj && typeof obj === 'object' && !Array.isArray(obj);
	const isConcatArray = opts && opts.concatArray;
	let result = Object.assign({}, target);
	if (isObject(target) && isObject(source)) {
		for (const [sourceKey, sourceValue] of Object.entries(source)) {
			const targetValue = target[sourceKey];
			if (isConcatArray && Array.isArray(sourceValue) && Array.isArray(targetValue)) {
				result[sourceKey] = targetValue.concat(...sourceValue);
			}
			else if (isObject(sourceValue) && target.hasOwnProperty(sourceKey)) {
				result[sourceKey] = mergeDeeply(targetValue, sourceValue, opts);
			}
			else {
				Object.assign(result, { [sourceKey]: sourceValue });
			}
		}
	}
	return result;
}


/**
 *  @func roundFloat
 *  @param {integer} n 丸める対象
 *  @param {integer} _digit 桁数、指定なければ２
 *  @return {float} 丸めた数値
 *  @desc 数値を丸める。
 */
let roundFloat = function (n, _digit) {
	if (!_digit) {
		_digit = 2
	}
	return parseFloat(n.toFixed(_digit));
}


/**
 *  @func checkValue
 *  @param {number} val チェック対象
 *  @param {number} min 最小値
 *  @param {number} max 最大値
 *  @return {number} チェックした後の数値
 *  @desc 数値を値域に合わせる
 */
let checkValue = function (val, min, max) {
	if (val < min) { val = min; }
	if (val > max) { val = max; }
	return val;
};




module.exports = { objectSort, getNow, getToday, getYesterday, isObjEmpty, mergeDeeply, roundFloat, checkValue };

//////////////////////////////////////////////////////////////////////
// EOF
//////////////////////////////////////////////////////////////////////
