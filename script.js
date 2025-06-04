// DOM要素の取得
const initialVelocityInput = document.getElementById('initialVelocity');
const accelerationInput = document.getElementById('acceleration');
const simSpeedInput = document.getElementById('simSpeed');
const startButton = document.getElementById('startButton');
const resetButton = document.getElementById('resetButton');
const timeDisplay = document.getElementById('timeDisplay');
const velocityDisplay = document.getElementById('velocityDisplay');
const positionDisplay = document.getElementById('positionDisplay');
const objectElement = document.getElementById('object');
const simulationArea = document.querySelector('.simulation-area');
const scaleMarksContainer = document.querySelector('.scale-marks');
const pathPlotsContainer = document.querySelector('.path-plots');

// 物理量の初期値と現在の値
let v0 = parseFloat(initialVelocityInput.value); // 初期速度 (m/s)
let a = parseFloat(accelerationInput.value);   // 加速度 (m/s^2)
let simSpeed = parseFloat(simSpeedInput.value); // シミュレーション速度倍率

let time = 0;      // 現在の時間 (s)
let velocity = v0; // 現在の速度 (m/s)
let position = 0;  // 現在の位置 (m)

// 軌跡プロット用の変数
let lastPlotTime = 0; // 前回プロットを追加した時刻 (s)
const PLOT_TIME_INTERVAL_S = 1; // ★1秒ごとにプロットを追加★

// アニメーションフレーム管理
let animationFrameId = null;
let lastTimestamp = 0;

// シミュレーションの状態
let isRunning = false;

// シミュレーションエリアの固定幅とスケール
const SIM_AREA_WIDTH_PX = 1200; // style.css で設定した新しい幅
const TOTAL_SIM_DISTANCE_M = 2000; // -1000m から 1000m まで
const SCALE_FACTOR = SIM_AREA_WIDTH_PX / 200; // 画面幅を200mで割る（仮の表示範囲）
// SCALE_FACTOR は表示する「メートルあたりのピクセル数」を表す。
// 例えば、200mを1200pxで表示するなら 1200 / 200 = 6px/m

// シミュレーション全体の物理的な範囲
const GLOBAL_MIN_POSITION_M = -1000;
const GLOBAL_MAX_POSITION_M = 1000;

// ★表示ウィンドウの現在の中心位置 (メートル)★
let currentViewCenterM = 0; // シミュレーション開始時は0mが中心

// スライド移動関連の変数
let isDragging = false;
let dragStartX = 0;
let initialViewCenterM = 0;

// --- 関数定義 ---

/**
 * メートルをピクセル位置に変換するヘルパー関数
 * @param {number} meterPosition - メートル単位の位置
 * @returns {number} ピクセル単位の位置
 */
function meterToPixel(meterPosition) {
    // currentViewCenterM を基準として、表示範囲の左端のメートル位置を計算
    const viewPortLeftM = currentViewCenterM - (SIM_AREA_WIDTH_PX / 2) / SCALE_FACTOR;
    return (meterPosition - viewPortLeftM) * SCALE_FACTOR;
}

/**
 * ピクセルをメートル位置に変換するヘルパー関数
 * @param {number} pixelPosition - ピクセル単位の位置
 * @returns {number} メートル単位の位置
 */
function pixelToMeter(pixelPosition) {
    const viewPortLeftM = currentViewCenterM - (SIM_AREA_WIDTH_PX / 2) / SCALE_FACTOR;
    return (pixelPosition / SCALE_FACTOR) + viewPortLeftM;
}


/**
 * 横軸の目盛りを生成する関数。
 * -1000mから1000mまでの範囲で5m間隔の目盛りと、10mごとのラベルを生成します。
 * ただし、表示範囲内のみ動的に生成・更新します。
 */
function generateScaleMarks() {
    scaleMarksContainer.innerHTML = ''; // 既存の目盛りをクリア

    // 現在の表示範囲を計算
    const viewPortLeftM = currentViewCenterM - (SIM_AREA_WIDTH_PX / 2) / SCALE_FACTOR;
    const viewPortRightM = currentViewCenterM + (SIM_AREA_WIDTH_PX / 2) / SCALE_FACTOR;

    // 目盛りの描画範囲を少し広めにとる
    const startMarkM = Math.floor(Math.max(GLOBAL_MIN_POSITION_M, viewPortLeftM - 50) / 5) * 5;
    const endMarkM = Math.ceil(Math.min(GLOBAL_MAX_POSITION_M, viewPortRightM + 50) / 5) * 5;

    for (let m = startMarkM; m <= endMarkM; m += 5) {
        const markX = meterToPixel(m);

        // シミュレーションエリアの端を大きく超える目盛りは描画しない
        if (markX < -100 || markX > SIM_AREA_WIDTH_PX + 100) continue;

        const markLine = document.createElement('div');
        markLine.classList.add('scale-mark');
        markLine.style.left = `${markX}px`;

        if (m % 100 === 0) { // 100mごとは長めの線
            markLine.style.height = '20px';
            markLine.style.backgroundColor = '#444';
        } else if (m % 50 === 0) { // 50mごとは中間の線
            markLine.style.height = '15px';
        } else if (m % 10 === 0) { // 10mごとは少し長めの線
            markLine.style.height = '12px';
        } else { // 5mは短めの線
            markLine.style.height = '6px';
        }
        scaleMarksContainer.appendChild(markLine);

        if (m % 100 === 0 || m % 50 === 0) { // 50mと100mごとのラベル
            const markLabel = document.createElement('span');
            markLabel.classList.add('scale-label');
            markLabel.textContent = `${m}m`;
            markLabel.style.left = `${markX}px`;
            scaleMarksContainer.appendChild(markLabel);
        }
    }
}

/**
 * シミュレーションの開始と一時停止を切り替える関数。
 */
function toggleSimulation() {
    if (isRunning) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        isRunning = false;
        startButton.textContent = 'スタート';
    } else {
        isRunning = true;
        startButton.textContent = '一時停止';
        lastTimestamp = performance.now(); // アニメーション開始時のタイムスタンプを記録
        animationFrameId = requestAnimationFrame(animate);
    }
}

/**
 * シミュレーションの状態を初期化する関数。
 * 入力値の取得、物理量のリセット、オブジェクトの初期位置設定などを行います。
 */
function initializeSimulation() {
    // 既存のアニメーションがあれば停止
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }

    // 入力値の取得
    v0 = parseFloat(initialVelocityInput.value);
    a = parseFloat(accelerationInput.value);
    simSpeed = parseFloat(simSpeedInput.value);

    // 物理量をリセット
    time = 0;
    velocity = v0;
    position = 0; // スタート地点は常に0m
    lastPlotTime = 0; // プロット時刻をリセット

    // ★表示ウィンドウの中心を0mにリセット★
    currentViewCenterM = 0;

    // オブジェクトの初期位置を0m (中央) に設定
    objectElement.style.left = `${meterToPixel(0)}px`;

    // 軌跡のプロットをクリア
    pathPlotsContainer.innerHTML = '';

    // 表示を更新
    updateDisplay();

    // 横軸目盛りの再生成
    generateScaleMarks();

    // フラグをリセットし、ボタン表示を「スタート」に戻す
    isRunning = false;
    startButton.textContent = 'スタート';
}

/**
 * シミュレーションのメインアニメーションループ。
 * requestAnimationFrameによってフレームごとに呼び出されます。
 * @param {DOMHighResTimeStamp} timestamp - 現在のタイムスタンプ
 */
function animate(timestamp) {
    if (!isRunning) return;

    const deltaTime = (timestamp - lastTimestamp) / 1000 * simSpeed;
    lastTimestamp = timestamp;

    time += deltaTime;
    const newPosition = v0 * time + 0.5 * a * time * time;
    const newVelocity = v0 + a * time;

    // --- 軌跡のプロットのロジック ---
    if (Math.floor(time / PLOT_TIME_INTERVAL_S) > Math.floor(lastPlotTime / PLOT_TIME_INTERVAL_S)) {
        const currentPlotPointTime = Math.floor(time / PLOT_TIME_INTERVAL_S) * PLOT_TIME_INTERVAL_S;

        if (currentPlotPointTime > lastPlotTime) {
             const plotPositionAtTime = v0 * currentPlotPointTime + 0.5 * a * currentPlotPointTime * currentPlotPointTime;
             const plotVelocityAtTime = v0 + a * currentPlotPointTime;

            if (plotPositionAtTime >= GLOBAL_MIN_POSITION_M && plotPositionAtTime <= GLOBAL_MAX_POSITION_M) {
                // ★経過時間を引数として追加★
                addPathPlot(plotPositionAtTime, plotVelocityAtTime, currentPlotPointTime);
            }
            lastPlotTime = currentPlotPointTime;
        }
    }

    position = newPosition;
    velocity = newVelocity;

    objectElement.style.left = `${meterToPixel(position)}px`;

    const objectScreenX = meterToPixel(position);
    const centerScreenX = SIM_AREA_WIDTH_PX / 2;
    const scrollThreshold = SIM_AREA_WIDTH_PX * 0.2;

    if (objectScreenX < centerScreenX - scrollThreshold || objectScreenX > centerScreenX + scrollThreshold) {
        currentViewCenterM = position;
        const viewPortWidthM = SIM_AREA_WIDTH_PX / SCALE_FACTOR;
        const halfViewPortWidthM = viewPortWidthM / 2;

        if (currentViewCenterM - halfViewPortWidthM < GLOBAL_MIN_POSITION_M) {
            currentViewCenterM = GLOBAL_MIN_POSITION_M + halfViewPortWidthM;
        }
        if (currentViewCenterM + halfViewPortWidthM > GLOBAL_MAX_POSITION_M) {
            currentViewCenterM = GLOBAL_MAX_POSITION_M - halfViewPortWidthM;
        }

        updateElementsPosition();
    }

    updateDisplay();

    if (position >= GLOBAL_MIN_POSITION_M && position <= GLOBAL_MAX_POSITION_M) {
        animationFrameId = requestAnimationFrame(animate);
    } else {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        isRunning = false;
        startButton.textContent = 'スタート';
    }
}

/**
 * シミュレーションエリアに軌跡のプロットを追加する関数。
 * @param {number} plotPositionM - プロットする位置 (m)
 * @param {number} plotVelocityM - プロットする時点の速度 (m/s)
 * @param {number} plotTimeS - プロットする時点の経過時間 (s) // ★新しい引数★
 */
function addPathPlot(plotPositionM, plotVelocityM, plotTimeS) { // ★引数を追加★
    const plotDot = document.createElement('div');
    plotDot.classList.add('plot-dot');
    plotDot.setAttribute('data-position', plotPositionM);
    plotDot.style.left = `${meterToPixel(plotPositionM)}px`;
    pathPlotsContainer.appendChild(plotDot);

    // ★経過時間表示用のラベルを追加 (一番上) ★
    const timeLabel = document.createElement('span');
    timeLabel.classList.add('plot-time-label'); // 新しいCSSクラスを追加
    timeLabel.textContent = `${plotTimeS.toFixed(1)}s`; // 経過時間を小数点以下1桁で表示
    timeLabel.setAttribute('data-position', plotPositionM);
    timeLabel.style.left = `${meterToPixel(plotPositionM)}px`;
    pathPlotsContainer.appendChild(timeLabel);

    // 速度表示用のラベル (中央)
    const velocityLabel = document.createElement('span');
    velocityLabel.classList.add('plot-velocity-label');
    velocityLabel.textContent = `${plotVelocityM.toFixed(1)}m/s`;
    velocityLabel.setAttribute('data-position', plotPositionM);
    velocityLabel.style.left = `${meterToPixel(plotPositionM)}px`;
    pathPlotsContainer.appendChild(velocityLabel);

    // 距離表示用のラベル (一番下)
    const distanceLabel = document.createElement('span');
    distanceLabel.classList.add('plot-distance-label');
    distanceLabel.textContent = `${plotPositionM.toFixed(1)}m`;
    distanceLabel.setAttribute('data-position', plotPositionM);
    distanceLabel.style.left = `${meterToPixel(plotPositionM)}px`;
    pathPlotsContainer.appendChild(distanceLabel);
}

/**
 * スライド移動や自動スクロール時に、すべての要素の位置を再計算して更新する関数。
 */
function updateElementsPosition() {
    objectElement.style.left = `${meterToPixel(position)}px`;

    const plotDots = pathPlotsContainer.querySelectorAll('.plot-dot');
    plotDots.forEach(dot => {
        const plotPositionM = parseFloat(dot.getAttribute('data-position'));
        dot.style.left = `${meterToPixel(plotPositionM)}px`;
    });

    // ★経過時間ラベルの位置を更新★
    const timeLabels = pathPlotsContainer.querySelectorAll('.plot-time-label');
    timeLabels.forEach(label => {
        const plotPositionM = parseFloat(label.getAttribute('data-position'));
        label.style.left = `${meterToPixel(plotPositionM)}px`;
    });

    const velocityLabels = pathPlotsContainer.querySelectorAll('.plot-velocity-label');
    velocityLabels.forEach(label => {
        const plotPositionM = parseFloat(label.getAttribute('data-position'));
        label.style.left = `${meterToPixel(plotPositionM)}px`;
    });

    const distanceLabels = pathPlotsContainer.querySelectorAll('.plot-distance-label');
    distanceLabels.forEach(label => {
        const plotPositionM = parseFloat(label.getAttribute('data-position'));
        label.style.left = `${meterToPixel(plotPositionM)}px`;
    });

    generateScaleMarks();
}


/**
 * 現在の時間、速度、位置を画面に表示する関数。
 */
function updateDisplay() {
    timeDisplay.textContent = time.toFixed(2);
    velocityDisplay.textContent = velocity.toFixed(2);
    positionDisplay.textContent = position.toFixed(2);
}

// --- イベントリスナー ---

// 入力値が変更されたら、シミュレーションを初期化し、停止状態に戻す
initialVelocityInput.addEventListener('change', initializeSimulation);
accelerationInput.addEventListener('change', initializeSimulation);
simSpeedInput.addEventListener('change', initializeSimulation);

// スタート/一時停止ボタンのクリックイベント
startButton.addEventListener('click', toggleSimulation);

// リセットボタンのクリックイベント
resetButton.addEventListener('click', initializeSimulation);

// ★シミュレーションエリアのドラッグによるスライド移動機能★
simulationArea.addEventListener('mousedown', (e) => {
    if (isRunning) return; // シミュレーション中はドラッグ無効

    isDragging = true;
    dragStartX = e.clientX;
    initialViewCenterM = currentViewCenterM; // ドラッグ開始時の中心位置を記録
    simulationArea.style.cursor = 'grabbing'; // カーソルを変更
});

simulationArea.addEventListener('mousemove', (e) => {
    if (!isDragging) return;

    const dragDeltaPx = e.clientX - dragStartX; // ドラッグによるピクセル移動量
    const dragDeltaM = dragDeltaPx / SCALE_FACTOR; // ピクセル移動量をメートルに変換

    // 新しい中心位置を計算 (ドラッグ方向と反対に動かすためマイナス)
    let newViewCenterM = initialViewCenterM - dragDeltaM;

    // 表示範囲の境界チェック
    const viewPortWidthM = SIM_AREA_WIDTH_PX / SCALE_FACTOR;
    const halfViewPortWidthM = viewPortWidthM / 2;

    if (newViewCenterM - halfViewPortWidthM < GLOBAL_MIN_POSITION_M) {
        newViewCenterM = GLOBAL_MIN_POSITION_M + halfViewPortWidthM;
    }
    if (newViewCenterM + halfViewPortWidthM > GLOBAL_MAX_POSITION_M) {
        newViewCenterM = GLOBAL_MAX_POSITION_M - halfViewPortWidthM;
    }

    currentViewCenterM = newViewCenterM;

    // 全要素の位置を更新
    updateElementsPosition();
});

simulationArea.addEventListener('mouseup', () => {
    isDragging = false;
    simulationArea.style.cursor = 'grab'; // カーソルを元に戻す
});

simulationArea.addEventListener('mouseleave', () => {
    // エリア外に出たらドラッグを終了
    isDragging = false;
    simulationArea.style.cursor = 'grab';
});

// ★シミュレーションエリアのドラッグによるスライド移動機能★
simulationArea.addEventListener('mousedown', (e) => {
    if (isRunning) return; // シミュレーション中はドラッグ無効

    isDragging = true;
    dragStartX = e.clientX;
    initialViewCenterM = currentViewCenterM; // ドラッグ開始時の中心位置を記録
    simulationArea.style.cursor = 'grabbing'; // カーソルを変更
});

simulationArea.addEventListener('mousemove', (e) => {
    if (!isDragging) return;

    const dragDeltaPx = e.clientX - dragStartX; // ドラッグによるピクセル移動量
    const dragDeltaM = dragDeltaPx / SCALE_FACTOR; // ピクセル移動量をメートルに変換

    // 新しい中心位置を計算 (ドラッグ方向と反対に動かすためマイナス)
    let newViewCenterM = initialViewCenterM - dragDeltaM;

    // 表示範囲の境界チェック
    const viewPortWidthM = SIM_AREA_WIDTH_PX / SCALE_FACTOR;
    const halfViewPortWidthM = viewPortWidthM / 2;

    if (newViewCenterM - halfViewPortWidthM < GLOBAL_MIN_POSITION_M) {
        newViewCenterM = GLOBAL_MIN_POSITION_M + halfViewPortWidthM;
    }
    if (newViewCenterM + halfViewPortWidthM > GLOBAL_MAX_POSITION_M) {
        newViewCenterM = GLOBAL_MAX_POSITION_M - halfViewPortWidthM;
    }

    currentViewCenterM = newViewCenterM;

    // 全要素の位置を更新
    updateElementsPosition();
});

simulationArea.addEventListener('mouseup', () => {
    isDragging = false;
    simulationArea.style.cursor = 'grab'; // カーソルを元に戻す
});

simulationArea.addEventListener('mouseleave', () => {
    // エリア外に出たらドラッグを終了
    isDragging = false;
    simulationArea.style.cursor = 'grab';
});

// ★タッチイベントの追加★
simulationArea.addEventListener('touchstart', (e) => {
    if (isRunning) return; // シミュレーション中はタッチ操作無効
    e.preventDefault(); // デフォルトのスクロール動作などを防止

    isDragging = true;
    // 最初のタッチポイントのX座標を取得
    dragStartX = e.touches[0].clientX;
    initialViewCenterM = currentViewCenterM;
    // タッチデバイスではカーソルの変更は直接反映されないが、ロジックとしては含める
    simulationArea.style.cursor = 'grabbing';
}, { passive: false }); // preventDefault() を使うため passive: false に設定

simulationArea.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    e.preventDefault(); // デフォルトのスクロール動作などを防止

    // 現在のタッチポイントのX座標を取得
    const currentTouchX = e.touches[0].clientX;
    const dragDeltaPx = currentTouchX - dragStartX;
    const dragDeltaM = dragDeltaPx / SCALE_FACTOR;

    let newViewCenterM = initialViewCenterM - dragDeltaM;

    const viewPortWidthM = SIM_AREA_WIDTH_PX / SCALE_FACTOR;
    const halfViewPortWidthM = viewPortWidthM / 2;

    if (newViewCenterM - halfViewPortWidthM < GLOBAL_MIN_POSITION_M) {
        newViewCenterM = GLOBAL_MIN_POSITION_M + halfViewPortWidthM;
    }
    if (newViewCenterM + halfViewPortWidthM > GLOBAL_MAX_POSITION_M) {
        newViewCenterM = GLOBAL_MAX_POSITION_M - halfViewPortWidthM;
    }

    currentViewCenterM = newViewCenterM;

    updateElementsPosition();
}, { passive: false }); // preventDefault() を使うため passive: false に設定

simulationArea.addEventListener('touchend', () => {
    isDragging = false;
    simulationArea.style.cursor = 'grab';
});

simulationArea.addEventListener('touchcancel', () => {
    isDragging = false;
    simulationArea.style.cursor = 'grab';
});

// 初期表示とアニメーションの準備
initializeSimulation(); // ページロード時に一度初期化
