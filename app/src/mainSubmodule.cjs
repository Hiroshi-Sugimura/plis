//////////////////////////////////////////////////////////////////////
// Copyright (C) Hiroshi SUGIMURA 2022.09.06
//////////////////////////////////////////////////////////////////////
/**
 * @module mainSubmodule
 * @summary 共通ユーティリティ関数。キーソート / 日付取得 / ディープマージ / 丸め / 値域クランプなど。
 */

//////////////////////////////////////////////////////////////////////
/**
 * オブジェクトのキーを昇順に並べ替えた浅いコピーを返す。
 * @param {Record<string, any>} obj 対象オブジェクト
 * @returns {Record<string, any>} 並べ替え済み新規オブジェクト
 */
function objectSort(obj) {
	const keys = Object.keys(obj).sort();
	const map = {};
	for (const k of keys) map[k] = obj[k];
	return map;
}

/**
 * 現在時刻を "YYYY-MM-DD hh:mm:ss" 文字列で返す。
 * @returns {string}
 */
function getNow() {
	const now = new Date();
	const date = [
		now.getFullYear().toString(),
		('0' + (now.getMonth() + 1)).slice(-2),
		('0' + now.getDate()).slice(-2)
	].join('-');
	const time = [
		('0' + now.getHours()).slice(-2),
		('0' + now.getMinutes()).slice(-2),
		('0' + now.getSeconds()).slice(-2)
	].join(':');
	return date + ' ' + time;
}

/**
 * 今日の日付を文字列で返す。
 * フォーマット: "YYYY-MM-DD"
 * 注意: Date.today() は外部拡張（date-utils 等）に依存するよ。
 * @returns {string}
 */
function getToday() {
	return Date.today().toFormat('YYYY-MM-DD');
}

/**
 * 昨日の日付を文字列で返す。
 * フォーマット: "YYYY-MM-DD"
 * 注意: Date.yesterday() は外部拡張（date-utils 等）に依存するよ。
 * @returns {string}
 */
function getYesterday() {
	return Date.yesterday().toFormat('YYYY-MM-DD');
}
/**
 * オブジェクトが空かどうかをチェックする。
 * Object 型は == {} では比較できないのでキー数で判定するよ。
 * @param {Record<string, any>} obj
 * @returns {boolean} 空なら true
 */
function isObjEmpty(obj) {
	return Object.keys(obj).length === 0;
}


/**
 * @typedef {Object} MergeOptions
 * @property {boolean} [concatArray=false] 同じキーの配列は結合(concat)するか。false の場合は置換。
 */

/**
 * 深いマージを実現する（入力は不変、結果は新しいオブジェクト）。
 * - オブジェクト同士は再帰的にマージ
 * - 配列は既定では置換、opts.concatArray=true で連結
 * - プリミティブ値は後勝ち
 * @param {Record<string, any>} target マージ対象かつベース
 * @param {Record<string, any>} source マージ元
 * @param {MergeOptions} [opts] 配列の扱い等のオプション
 * @returns {Record<string, any>} マージ結果
 */
function mergeDeeply(target, source, opts) {
	const isObject = o => o && typeof o === 'object' && !Array.isArray(o);
	const concat = opts && opts.concatArray;
	let result = { ...target };
	if (isObject(target) && isObject(source)) {
		for (const [k, v] of Object.entries(source)) {
			const tv = target[k];
			if (concat && Array.isArray(v) && Array.isArray(tv)) {
				result[k] = tv.concat(...v);
			} else if (isObject(v) && Object.prototype.hasOwnProperty.call(target, k)) {
				result[k] = mergeDeeply(tv, v, opts);
			} else {
				result[k] = v;
			}
		}
	}
	return result;
}


/**
 * 浮動小数を指定桁で丸める（四捨五入）。
 * @param {number} n 丸める対象
 * @param {number} [_digit=2] 桁数（既定: 2）
 * @returns {number} 丸め後の数値
 */
function roundFloat(n, digit = 2) {
	return parseFloat(n.toFixed(digit));
}


/**
 * 数値を[min, max]の範囲にクランプする。
 * @param {number} val チェック対象
 * @param {number} min 最小値
 * @param {number} max 最大値
 * @returns {number} 範囲に収めた数値
 */
function checkValue(val, min, max) {
	if (val < min) { val = min; }
	if (val > max) { val = max; }
	return val;
}




module.exports = { objectSort, getNow, getToday, getYesterday, isObjEmpty, mergeDeeply, roundFloat, checkValue };

//////////////////////////////////////////////////////////////////////
// EOF
//////////////////////////////////////////////////////////////////////
