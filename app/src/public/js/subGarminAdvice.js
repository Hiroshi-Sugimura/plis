//////////////////////////////////////////////////////////////////////
//	Copyright (C) SUGIMURA Lab. 2024
//	Garminアドバイス表示処理
//  アンケート回答とGarminヘルスデータに基づくアドバイスをUI表示
//////////////////////////////////////////////////////////////////////
'use strict'

// 【追加】グローバルオブジェクトとして定義
const subGarminAdvice = {};

window.addEventListener('DOMContentLoaded', function () {
    console.log('## DOMContentLoaded subGarminAdvice.js');

    /**
     * @func showGarminAdvice
     * @desc アドバイスを画面に表示
     * @param {Object} advices - アドバイスデータ
     */
    subGarminAdvice.showGarminAdvice = function(advices) {
        console.log('📥 Received showGarminAdvice event');
        console.log('📊 Advice data:', advices);
        
        const adviceContainer = document.getElementById('garminAdviceContainer');
        if (!adviceContainer) {
            console.warn('⚠️ garminAdviceContainer not found');
            return;
        }

        // データが空の場合
        if (!advices || 
            (!advices.sleep?.length && 
             !advices.activity?.length && 
             !advices.stress?.length && 
             !advices.overall?.length)) {
            adviceContainer.innerHTML = `
                <div class="advice-placeholder">
                    <p><i class="fa-solid fa-circle-info"></i> データが不足しています。Garminデバイスでデータを記録してください。</p>
                </div>
            `;
            return;
        }

        let html = '<div class="advice-section">';
        let totalCount = 0;
        
        // ===== 総合アドバイス =====
        if (advices.overall && advices.overall.length > 0) {
            html += '<div class="advice-overall-section">';
            advices.overall.forEach(advice => {
                html += createOverallAdviceCard(advice);
                totalCount++;
            });
            html += '</div>';
        }

        // ===== 睡眠アドバイス =====
        if (advices.sleep && advices.sleep.length > 0) {
            html += '<div class="advice-category-section">';
            html += '<h3 class="advice-category-title"><i class="fa-solid fa-bed"></i> 睡眠</h3>';
            advices.sleep.forEach(advice => {
                html += createAdviceCard(advice);
                totalCount++;
            });
            html += '</div>';
        }

        // ===== 活動アドバイス =====
        if (advices.activity && advices.activity.length > 0) {
            html += '<div class="advice-category-section">';
            html += '<h3 class="advice-category-title"><i class="fa-solid fa-running"></i> 活動</h3>';
            advices.activity.forEach(advice => {
                html += createAdviceCard(advice);
                totalCount++;
            });
            html += '</div>';
        }

        // ===== ストレスアドバイス =====
        if (advices.stress && advices.stress.length > 0) {
            html += '<div class="advice-category-section">';
            html += '<h3 class="advice-category-title"><i class="fa-solid fa-heart-pulse"></i> ストレス管理</h3>';
            advices.stress.forEach(advice => {
                html += createAdviceCard(advice);
                totalCount++;
            });
            html += '</div>';
        }

        html += '</div>';
        adviceContainer.innerHTML = html;
        
        console.log(`✅ Displaying ${totalCount} advice cards`);
    };

    /**
     * @func createOverallAdviceCard
     * @desc 総合アドバイスカードのHTML生成
     */
    function createOverallAdviceCard(advice) {
        const iconMap = {
            'warning': 'fa-exclamation-triangle',
            'success': 'fa-check-circle',
            'info': 'fa-info-circle'
        };

        const icon = iconMap[advice.level] || 'fa-lightbulb';

        let html = `
            <div class="advice-card advice-overall advice-${advice.level}">
                <div class="advice-header">
                    <i class="fa-solid ${icon} advice-icon"></i>
                    <h4 class="advice-title">${escapeHtml(advice.title)}</h4>
                </div>
                <p class="advice-message">${escapeHtml(advice.message)}</p>
        `;

        // 優先事項リスト
        if (advice.priority && advice.priority.length > 0) {
            html += '<div class="advice-priority">';
            html += '<strong>優先事項:</strong>';
            html += '<ol class="advice-priority-list">';
            advice.priority.forEach(item => {
                html += `<li>${escapeHtml(item)}</li>`;
            });
            html += '</ol>';
            html += '</div>';
        }

        html += '</div>';
        return html;
    }

    /**
     * @func createAdviceCard
     * @desc 個別アドバイスカードのHTML生成
     */
    function createAdviceCard(advice) {
        const iconMap = {
            'warning': 'fa-exclamation-triangle',
            'success': 'fa-check-circle',
            'info': 'fa-info-circle',
            'notice': 'fa-bell'
        };

        const icon = iconMap[advice.level] || 'fa-lightbulb';

        let html = `
            <div class="advice-card advice-${advice.level}">
                <div class="advice-header">
                    <i class="fa-solid ${icon} advice-icon"></i>
                    <h4 class="advice-title">${escapeHtml(advice.title)}</h4>
                </div>
                <p class="advice-message">${escapeHtml(advice.message)}</p>
        `;

        // ヒント・アドバイスリスト
        if (advice.tips && advice.tips.length > 0) {
            html += '<div class="advice-tips-section">';
            html += '<strong class="advice-tips-header"><i class="fa-solid fa-lightbulb"></i> 改善のヒント:</strong>';
            html += '<ul class="advice-tips">';
            advice.tips.forEach(tip => {
                html += `<li>${escapeHtml(tip)}</li>`;
            });
            html += '</ul>';
            html += '</div>';
        }

        html += '</div>';
        return html;
    }

    /**
     * @func escapeHtml
     * @desc HTMLエスケープ処理（XSS対策）
     */
    function escapeHtml(text) {
        if (!text) return '';
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    /**
     * @func showAdviceLoading
     * @desc ローディング表示
     */
    function showAdviceLoading() {
        const adviceContainer = document.getElementById('garminAdviceContainer');
        if (!adviceContainer) return;

        adviceContainer.innerHTML = `
            <div class="advice-loading">
                <i class="fa-solid fa-spinner fa-spin"></i>
                <p>アドバイスを生成中...</p>
            </div>
        `;
    }

    /**
     * @func showAdviceError
     * @desc エラー表示
     */
    function showAdviceError(message = 'アドバイスの生成に失敗しました') {
        const adviceContainer = document.getElementById('garminAdviceContainer');
        if (!adviceContainer) return;

        adviceContainer.innerHTML = `
            <div class="advice-error">
                <i class="fa-solid fa-exclamation-triangle"></i>
                <p>${escapeHtml(message)}</p>
                <button onclick="window.getGarminAdvice()" class="btn-retry">
                    <i class="fa-solid fa-rotate"></i> 再試行
                </button>
            </div>
        `;
    }

    /**
     * @func window.getGarminAdvice
     * @desc アドバイス取得（更新ボタンから呼び出し）
     */
    window.getGarminAdvice = function(date) {
        console.log('🔄 Requesting Garmin advice...', date ? `for date: ${date}` : '(today)');
        
        const btn = document.getElementById('btnGetGarminAdvice');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 生成中...';
        }

        showAdviceLoading();

        // IPCでメインプロセスにリクエスト
        window.ipc.getGarminAdvice({ date: date })
            .then(() => {
                console.log('✅ Advice request sent');
                // 結果はshowGarminAdviceで受け取る
                if (btn) {
                    setTimeout(() => {
                        btn.disabled = false;
                        btn.innerHTML = '<i class="fa-solid fa-sync"></i> 更新';
                    }, 1000);
                }
            })
            .catch(error => {
                console.error('❌ Failed to get advice:', error);
                showAdviceError();
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fa-solid fa-sync"></i> 更新';
                }
            });
    };

    // ===== イベントリスナー設定 =====

    // アドバイス更新ボタン
    const btnGetAdvice = document.getElementById('btnGetGarminAdvice');
    if (btnGetAdvice) {
        btnGetAdvice.addEventListener('click', function() {
            window.getGarminAdvice();
        });
        console.log('✅ Advice button event listener attached');
    } else {
        console.warn('⚠️ btnGetGarminAdvice not found');
    }

    // 初期表示（プレースホルダー）
    const adviceContainer = document.getElementById('garminAdviceContainer');
    if (adviceContainer && !adviceContainer.innerHTML.trim()) {
        adviceContainer.innerHTML = `
            <div class="advice-placeholder">
                <i class="fa-solid fa-lightbulb" style="font-size: 3em; color: #ffc107; margin-bottom: 15px;"></i>
                <p style="font-size: 1.1em; margin: 10px 0;">
                    <strong>あなた専用のアドバイスを生成できます</strong>
                </p>
                <p style="color: #666; line-height: 1.6;">
                    「更新」ボタンを押すと、Garminデバイスで記録された睡眠・活動・ストレスデータと、<br>
                    アンケート回答を組み合わせた個別アドバイスが表示されます。
                </p>
                <button onclick="window.getGarminAdvice()" class="btn-get-advice-large">
                    <i class="fa-solid fa-magic"></i> アドバイスを生成する
                </button>
            </div>
        `;
    }

    console.log('✅ subGarminAdvice.js initialization completed');
});

// 【追加】windowオブジェクトに公開
window.subGarminAdvice = subGarminAdvice;
console.log('✅ subGarminAdvice exported to window');