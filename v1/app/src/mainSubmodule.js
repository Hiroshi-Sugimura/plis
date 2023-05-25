//////////////////////////////////////////////////////////////////////
//	Copyright (C) Hiroshi SUGIMURA 2022.09.06
//////////////////////////////////////////////////////////////////////
'use strict'

//////////////////////////////////////////////////////////////////////
// 基本ライブラリ


//////////////////////////////////////////////////////////////////////

// キーでソートしてからJSONにする
// 単純にJSONで比較するとオブジェクトの格納順序の違いだけで比較結果がイコールにならない
let objectSort = function (obj) {
	let keys = Object.keys(obj).sort();
	let map = {};
	keys.forEach(function(key){
		map[key] = obj[key];
	});

	return map;
};

// 現在時刻
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

// 今日の日付 ("YYYY-MM-DD")
let getToday = function() {
	let now = new Date();
	let today = [
		now.getFullYear().toString(),
		('0' + (now.getMonth() + 1)).slice(-2),
		('0' + now.getDate()).slice(-2)
		].join('-');
	return today;
};

// Object型が空{}かどうかチェックする
// == {} ではチェックできない。
let isObjEmpty = function (obj) {
	return Object.keys(obj).length === 0;
}


// 深いマージを実現する
// target: マージ対象かつマージ先
// source: マージ対象
// opts: 配列の取り扱い
// 配列の要素（中身）は結合(concat)したい場合、以下のようにして、さっきの関数を呼び出してやればOK
// opts = {concatArray: true}
let mergeDeeply = function(target, source, opts) {
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
				Object.assign(result, {[sourceKey]: sourceValue});
			}
		}
	}
	return result;
}

module.exports = {objectSort, getNow, getToday, isObjEmpty, mergeDeeply};
//////////////////////////////////////////////////////////////////////
// EOF
//////////////////////////////////////////////////////////////////////
