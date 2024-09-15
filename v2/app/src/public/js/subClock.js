/**
 * @namespace subClock
 */
// 'use strict'

(function (d) {

	//canvas要素を取得
	const el = d.querySelector('.clock');

	//コンテキストを取得
	const ctx = el.getContext('2d');
	// 基本色の設定
	ctx.fillStyle   = 'white';
	ctx.strokeStyle = 'black';

	//時計描画と現在時刻表示の関数を、1000ミリ秒ごとに実行する
	setInterval( () => {
		activateClock(ctx);
	}, 1000);

	//現在時刻を取得
	function _getCurTime() {
		const cur = new Date();
		const time = {
			hour : cur.getHours() % 12, //12時間制の数字
			hourOriginal : cur.getHours(), //24時間制の数字
			min :  cur.getMinutes(),
			sec : cur.getSeconds()
		};
		return time;
	}

	//現在時刻を表示
	function showCurTime(elm) {
		const insertArea = d.querySelector(elm);
		const h = _getCurTime().hourOriginal;
		const m = _getCurTime().min;
		const s = _getCurTime().sec;
		const msg = `${h}：${m}：${s}`;

		insertArea.innerHTML = msg;
	}

	//時計を描画
	function activateClock(ctx, time) {
		let width = el.width;
		let height = el.height;

		//背景の円を描画
		ctx.beginPath();
		ctx.arc( width/2, height/2, width/2+15, 0, 2 * Math.PI); //円のパスを設定　・・・補足１
		ctx.fill(); //円のパスを塗りつぶす

		//目盛を描画　・・・補足２
		for (let i = 0; i < 60; i++) {
			let r = 6 * Math.PI / 180 * i;
			const w = i % 5 === 0 ? 4 : 1;
			_setCtxStyle(ctx, 'white', 'black', w);
			_drawCtx(ctx, r, 100, -5);
		}

		//現在時刻を定数に代入
		const h   = _getCurTime().hour;
		const min = _getCurTime().min;
		const sec = _getCurTime().sec;

		//短針を描画　・・・補足３
		const hourR = h * 30 * Math.PI / 180 + min * 0.5 * Math.PI / 180;
		_setCtxStyle(ctx, '', 'black', 3);
		_drawCtx(ctx, hourR, 0, -60);

		//長針を描画　・・・補足３
		const minR = min * 6 * Math.PI / 180;
		_setCtxStyle(ctx, '', 'black', 3);
		_drawCtx(ctx, minR, 0, -90);

		//秒針を描画　・・・補足３
		const secR = sec * 6 * Math.PI / 180;
		_setCtxStyle(ctx, '', 'red', 1);
		_drawCtx(ctx, secR, 0, -70);
	}

	//コンテキストの描画スタイルを設定する関数
	function _setCtxStyle(ctx, fillColor, strokeColor, lineWidth) {
		ctx.fillStyle   = fillColor;
		ctx.strokeStyle = strokeColor;
		ctx.lineWidth   = lineWidth;
		ctx.lineCap     = 'round';
	}

	//線を描画する関数 ・・・補足４
	function _drawCtx(ctx, rotation, moveToY = 0, length) {
		let width = el.width;
		let height = el.height;
		ctx.save();
		ctx.translate( width/2, height/2);
		ctx.rotate(rotation);
		ctx.beginPath();
		ctx.moveTo(0, moveToY);
		ctx.lineTo(0, moveToY + length);
		ctx.stroke();
		ctx.restore();
	}

})(document);

