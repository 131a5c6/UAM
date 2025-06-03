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
const SIM_AREA_WIDTH_PX = 1200; // style.css で設定した新しい幅に合わせる (元は900)
const MIN_POSITION_M = -100;
const MAX_POSITION_M = 100;
const TOTAL_DISTANCE_M = MAX_POSITION_M - MIN_POSITION_M;
const SCALE_FACTOR = SIM_AREA_WIDTH_PX / TOTAL_DISTANCE_M; // これによりSCALE_FACTORが再計算される

// --- 関数定義 ---

/**
 * 横軸の目盛りを生成する関数。
 * -100mから100mまでの範囲で5m間隔の目盛りと、10mごとのラベルを生成します。
 */
function generateScaleMarks() {
    scaleMarksContainer.innerHTML = ''; // 既存の目盛りをクリア

    // -100m から 100m まで5m間隔で目盛りとラベルを生成
    for (let m = MIN_POSITION_M; m <= MAX_POSITION_M; m += 5) {
        // 0m を基準としたピクセル位置に変換 (例: -100m -> 0px, 0m -> 350px, 100m -> 700px)
        const markX = (m - MIN_POSITION_M) * SCALE_FACTOR; // MIN_POSITION_Mを引くことで0mが中央に来るように調整

        const markLine = document.createElement('div');
        markLine.classList.add('scale-mark');
        markLine.style.left = `${markX}px`;

        if (m % 10 === 0) { // 10mごとは長めの線
            markLine.style.height = '12px';
        } else { // 5mは短めの線
            markLine.style.height = '6px';
        }
        scaleMarksContainer.appendChild(markLine);

        if (m % 10 === 0) { // 10mごとのラベル
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

    // オブジェクトの初期位置を0m (中央) に設定
    // 0m がシミュレーションエリアの真ん中になるように調整
    objectElement.style.left = `${(0 - MIN_POSITION_M) * SCALE_FACTOR}px`;

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

    const deltaTime = (timestamp - lastTimestamp) / 1000 * simSpeed; // 秒単位で経過時間を計算し、シミュレーション速度を適用
    lastTimestamp = timestamp;

    // 物理量の更新
    time += deltaTime;
    const newPosition = v0 * time + 0.5 * a * time * time; // 等加速度運動の公式 x = v0t + 0.5at^2

    // --- 軌跡のプロットのロジック ---
    // PLOT_TIME_INTERVAL_S ごとにプロットを追加
    if (Math.floor(time / PLOT_TIME_INTERVAL_S) > Math.floor(lastPlotTime / PLOT_TIME_INTERVAL_S)) {
        // 現在の区間 (例: 0-1s, 1-2s...) を超えた場合にプロット
        const currentPlotPointTime = Math.floor(time / PLOT_TIME_INTERVAL_S) * PLOT_TIME_INTERVAL_S;

        // 新しいプロット点か確認し、範囲内でのみプロット
        if (currentPlotPointTime > lastPlotTime && newPosition >= MIN_POSITION_M && newPosition <= MAX_POSITION_M) {
             // その時刻での正確な位置を計算してプロット
            const plotPositionAtTime = v0 * currentPlotPointTime + 0.5 * a * currentPlotPointTime * currentPlotPointTime;
            addPathPlot(plotPositionAtTime);
            lastPlotTime = currentPlotPointTime;
        }
    }

    position = newPosition; // 位置を更新
    velocity = v0 + a * time; // 速度を更新 v = v0 + at

    // オブジェクトのDOM要素の位置を更新
    // -100m が 0px、0m が 350px、100m が 700px に対応するように調整
    const objectX = (position - MIN_POSITION_M) * SCALE_FACTOR; // MIN_POSITION_Mを引いて基準を調整
    objectElement.style.left = `${objectX}px`;

    // 数値表示の更新
    updateDisplay();

    // 画面の左右端（-100mと100m）を完全に超えたらアニメーションを停止
    // オブジェクトの幅を考慮して、完全に画面外に出たかを判断
    const objectHalfWidthM = (objectElement.offsetWidth / 2) / SCALE_FACTOR; // 物体半分の長さ(m)
    if (position >= MIN_POSITION_M - objectHalfWidthM && position <= MAX_POSITION_M + objectHalfWidthM) {
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
 */
function addPathPlot(plotPositionM) {
    const plotDot = document.createElement('div');
    plotDot.classList.add('plot-dot');
    // オブジェクトの中心がその位置に来るように調整
    plotDot.style.left = `${(plotPositionM - MIN_POSITION_M) * SCALE_FACTOR}px`; // MIN_POSITION_Mを引いて基準を調整
    pathPlotsContainer.appendChild(plotDot);

    // 距離表示用のラベル
    const distanceLabel = document.createElement('span');
    distanceLabel.classList.add('plot-distance-label'); // 新しいCSSクラスを追加
    distanceLabel.textContent = `${plotPositionM.toFixed(1)}m`; // 距離を小数点以下1桁で表示
    distanceLabel.style.left = `${(plotPositionM - MIN_POSITION_M) * SCALE_FACTOR}px`; // MIN_POSITION_Mを引いて基準を調整
    pathPlotsContainer.appendChild(distanceLabel);
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

// 初期表示とアニメーションの準備
initializeSimulation(); // ページロード時に一度初期化
