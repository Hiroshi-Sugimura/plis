//////////////////////////////////////////////////////////////////////
//	Copyright (C) SUGIMURA Lab. 2022.08.26
//	toast関係の処理
//////////////////////////////////////////////////////////////////////
/**
 * @namespace subToast
 */
'use strict'


////////////////////////////////////////////////////////////////////////////////
// HTMLロードしたら準備
window.addEventListener('DOMContentLoaded', function () {
	console.dir('## DOMContentLoaded toast.js');

	// toast
	let divToast        = document.getElementById('divToast');
	let toastMessages   = [];

	/** 
	 * @func addToast
	 * @desc トーストする文字列をキューイングする、インタフェース
	 * @param {void}
	 * @return {void}
	 */
	window.addToast = function( type, message ) {
		let t = '';

		switch( type ) {
			case 'Info':
			t = '<section class="inf_toast"> <img src="./img/loadingRed.gif">' + message + '</section>';
			break;

			case 'Error':
			t = '<section class="err_toast"> <img src="./img/loadingRed.gif">' + message + '</section>';
			break;
		}

		toastMessages.push(t);
		redrawToast();

		setTimeout( () => {
			toastMessages.pop();
			redrawToast();
		}, 3000);
	};

	/** 
	 * @func redrawToast
	 * @desc トーストは表示タイミングで位置合わせをする、内部関数
	 * @param {void}
	 * @return {void}
	 */
	window.redrawToast = function() {
		let disp = "";
		// console.dir( toastMessages );

		// 表示位置
		let dispTop = 100;
		toastMessages.forEach( (elem)=>{
			let t = '<div class="toast" style="top:' + dispTop + 'px">' + elem + '</div>';
			disp += t;
			dispTop += 100;
			// console.log( dispTop );
		});
		divToast.innerHTML = disp;
	};


} );
