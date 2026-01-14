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
 * 日付オブジェクトを任意のフォーマット文字列に変換する。
 * @param {Date} date 対象の日付オブジェクト
 * @param {string} format フォーマット文字列 (例: "YYYY-MM-DD HH24:MI:SS")
 * @returns {string} フォーマット済み文字列
 */
function formatDate(date, format) {
    if (!date) return '';
    if (typeof date === 'string') {
        date = new Date(date);
    }
    if (!(date instanceof Date) || isNaN(date.getTime())) {
        return '';
    }
    let result = format;
    result = result.replace(/YYYY/g, date.getFullYear());
    result = result.replace(/MM/g, ('0' + (date.getMonth() + 1)).slice(-2));
    result = result.replace(/DD/g, ('0' + date.getDate()).slice(-2));
    result = result.replace(/HH24/g, ('0' + date.getHours()).slice(-2));
    result = result.replace(/MI/g, ('0' + date.getMinutes()).slice(-2));
    result = result.replace(/SS/g, ('0' + date.getSeconds()).slice(-2));
    result = result.replace(/HH/g, ('0' + (date.getHours() % 12)).slice(-2));
    return result;
}

/**
 * 今日の日付を "YYYY-MM-DD" で取得。
 * @returns {string}
 */
function getTodayDate() {
    return formatDate(new Date(), 'YYYY-MM-DD');
}

/**
 * 昨日の日付を "YYYY-MM-DD" で取得。
 * @returns {string}
 */
function getYesterdayDate() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return formatDate(d, 'YYYY-MM-DD');
}

/**
 * 今日の日付を文字列で返す。
 * @deprecated getTodayDate を使用してください。
 * @returns {string}
 */
function getToday() {
    return getTodayDate();
}

/**
 * 昨日の日付を文字列で返す。
 * @deprecated getYesterdayDate を使用してください。
 * @returns {string}
 */
function getYesterday() {
    return getYesterdayDate();
}

/**
 * オブジェクトが空かどうかをチェックする。
 * Object 型は == {} では比較できないのでキー数で判定するよ。
 * @param {Record<string, any>} obj
 * @returns {boolean} 空なら true
 */
function isObjEmpty(obj) {
    if (!obj) return true;
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




/**
 * SQL CASE文生成（3分刻み集計用）。
 * @param {Date} date 対象日
 * @returns {string} SQL CASE文
 */
function getCases(date) {
    let T1 = new Date(date);
    let T2 = new Date(date);
    let T3 = new Date(date);
    let T4 = new Date(date);

    // UTCだがStringにて表現しているので、なんか複雑
    T1.setHours(T1.getHours() - T1.getHours() - 10, 57, 0, 0); // 前日の14時57分xx秒   14:57:00 .. 15:00:00 --> 00:00
    T2.setHours(T1.getHours() - T1.getHours() - 10, 58, 0, 0); // T1 + 1min
    T3.setHours(T1.getHours() - T1.getHours() - 10, 59, 0, 0); // T1 + 2min
    T4.setHours(T1.getHours() - T1.getHours(), 0, 0, 0); // 集約先

    let ret = "";
    for (let t = 0; t < 480; t += 1) {  // 24h * 20 times (= 60min / 3min)
        ret += `WHEN "createdAt" LIKE "${formatDate(T1, 'YYYY-MM-DD HH24:MI')}%" OR "createdAt" LIKE "${formatDate(T2, 'YYYY-MM-DD HH24:MI')}%" OR "createdAt" LIKE "${formatDate(T3, 'YYYY-MM-DD HH24:MI')}%" THEN "${formatDate(T4, 'HH24:MI')}" \n`;

        T1.setMinutes(T1.getMinutes() + 3); // + 3 min
        T2.setMinutes(T2.getMinutes() + 3); // + 3 min
        T3.setMinutes(T3.getMinutes() + 3); // + 3 min
        T4.setMinutes(T4.getMinutes() + 3); // + 3 min
    }
    return ret + 'ELSE "24:00"';
}

export { objectSort, getNow, formatDate, getTodayDate, getYesterdayDate, getToday, getYesterday, isObjEmpty, mergeDeeply, roundFloat, checkValue, getCases };

//////////////////////////////////////////////////////////////////////
// EOF
//////////////////////////////////////////////////////////////////////
