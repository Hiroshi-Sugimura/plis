//////////////////////////////////////////////////////////////////////
//	Copyright (C) SUGIMURA Lab. 2021.11.05
//	アンケート関係の処理
//////////////////////////////////////////////////////////////////////
'use strict'


////////////////////////////////////////////////////////////////////////////////
// HTMLロードしたら準備
window.addEventListener('DOMContentLoaded', function () {
	console.dir('## DOMContentLoaded subQuestionnaire.js');

	// アンケート回答の投稿ボタンを押したときの処理
	window.getQuestionnaire = function () {
		// 大項目ごとの小項目の数の上限の定義
		const qnums = {
			"1": 9,
			"2": 9,
			"3": 7,
			"4": 12,
			"5": 10,
			"6": 7
		};

		let err = ''; // エラーメッセージ
		let submitData = {}; // 送信データ

		try {
			// 小項目ごとにラジオボタンがチェックされているかをチェック
			for (let i = 1; i <= 6; i++) {
				for (let j = 1; j <= qnums[i.toString()]; j++) {
					let name = 'q_' + i + '_' + j;

					let elem = document.getElementsByName(name);
					let len = elem.length;
					let val = '';
					for( let i=0; i<len; i+=1 ) {
						if (elem.item(i).checked) {
							val = elem.item(i).value;
						}
					}

					if (!val) {
						throw new Error('質問 ' + i + '.' + j + '. に回答してください。');
					}else{
						submitData[name] = val;
					}
				}
			}
			// 投稿の確認ダイアログを表示
			let res = window.confirm('本当に投稿してもよろしいですか？');
			if (res === false) {
				return null;
			}
			return submitData;

		} catch (error) {
			// 未回答エラーをポップアップ
			window.alert(error.message);
			return null;
		}
	};

} );
