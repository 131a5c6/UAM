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
const SIM_AREA_WIDTH_PX = 700; // HTML/CSSで設定した固定幅 (px)
const MAX_POSITION_M = 100; // 右端を100mとする
const SCALE_FACTOR = SIM_AREA_WIDTH_PX / MAX_POSITION_M; // メートルをピクセルに変換する係数

// --- 関数定義 ---

// 横軸の目盛りを生成
function generateScaleMarks() {
    scaleMarksContainer.innerHTML = ''; // 既存の目盛りをクリア

    // 10mごとの目盛りと、その間に5mの補助目盛り
    for (let m = 0; m <= MAX_POSITION_M; m += 5) {
        const markX = m * SCALE_FACTOR;

        const markLine = document.createElement('div');
        markLine.classList.add('scale-mark');
        markLine.style.left = `${markX}px`;

        // 10mごとは長めの線、5mは短めの線
        if (m % 10 === 0) {
            markLine.style.height = '12px'; // 長い目盛り線
            // markLine.style.backgroundColor = '#333'; // CSSで設定
        } else {
            markLine.style.height = '6px'; // 短い目盛り線
            // markLine.style.backgroundColor = '#aaa'; // CSSで設定
        }
        scaleMarksContainer.appendChild(markLine);

        // 10mごとのラベル
        if (m % 10 === 0) {
            const markLabel = document.createElement('span');
            markLabel.classList.add('scale-label');
            markLabel.textContent = `${m}m`;
            markLabel.style.left = `${markX}px`;
            scaleMarksContainer.appendChild(markLabel);
        }
    }
}

// シミュレーションの開始/一時停止を切り替える
function toggleSimulation() {
    if (isRunning) {
        // 一時停止
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        startButton.textContent = 'スタート';
    } else {
        // スタート
        startButton.textContent = '一時停止';
        lastTimestamp = performance.now(); // スタート時にタイムスタンプを初期化
        animationFrameId = requestAnimationFrame(animate);
    }
    isRunning = !isRunning;
}

// 初期化
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
    position = 0;
    lastPlotTime = 0; // プロット時刻をリセット

    // オブジェクトの位置をリセット
    objectElement.style.left = '0px';

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

// アニメーションループ
function animate(timestamp) {
    if (!isRunning) return;

    const deltaTime = (timestamp - lastTimestamp) / 1000 * simSpeed;
    lastTimestamp = timestamp;

    // 物理量の更新
    time += deltaTime;
    const newPosition = v0 * time + 0.5 * a * time * time;

    // --- 軌跡のプロットのロジック ---
    // PLOT_TIME_INTERVAL_S ごとにプロットを追加
    if (Math.floor(time / PLOT_TIME_INTERVAL_S) > Math.floor(lastPlotTime / PLOT_TIME_INTERVAL_S)) {
        // 現在の区間 (例: 0-1s, 1-2s...) を超えた場合にプロット
        const currentPlotPointTime = Math.floor(time / PLOT_TIME_INTERVAL_S) * PLOT_TIME_INTERVAL_S;

        // 右端100mを超えてプロットしないように調整
        if (currentPlotPointTime > lastPlotTime && newPosition <= MAX_POSITION_M) { // 新しいプロット点か確認
             // その時刻での正確な位置を計算してプロット
            const plotPositionAtTime = v0 * currentPlotPointTime + 0.5 * a * currentPlotPointTime * currentPlotPointTime;
            addPathPlot(plotPositionAtTime);
            lastPlotTime = currentPlotPointTime;
        }
    }


    position = newPosition; // 位置を更新
    velocity = v0 + a * time; // 速度を更新

    // オブジェクトのDOM要素の位置を更新
    const objectX = position * SCALE_FACTOR;
    objectElement.style.left = `${objectX}px`;

    // 数値表示の更新
    updateDisplay();

    // 画面の右端（100m地点）を超えたらアニメーションを停止
    if (position < MAX_POSITION_M + (objectElement.offsetWidth / (2 * SCALE_FACTOR)) ) { // オブジェクトが完全に画面外に出るまで (中心基準で画面外)
        animationFrameId = requestAnimationFrame(animate);
    } else {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        isRunning = false;
        startButton.textContent = 'スタート';
    }
}

// 軌跡のプロットを追加
function addPathPlot(plotPositionM) {
    const plotDot = document.createElement('div');
    plotDot.classList.add('plot-dot');
    // オブジェクトの中心がその位置に来るように調整
    plotDot.style.left = `${plotPositionM * SCALE_FACTOR}px`;
    pathPlotsContainer.appendChild(plotDot);

    // ★追加: 距離表示用のラベル★
    const distanceLabel = document.createElement('span');
    distanceLabel.classList.add('plot-distance-label'); // 新しいCSSクラスを追加
    distanceLabel.textContent = `${plotPositionM.toFixed(1)}m`; // 距離を小数点以下1桁で表示
    distanceLabel.style.left = `${plotPositionM * SCALE_FACTOR}px`;
    pathPlotsContainer.appendChild(distanceLabel);
}


// 表示数値の更新
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

// スタート/一時停止ボタンクリック
startButton.addEventListener('click', toggleSimulation);

// リセットボタンクリック
resetButton.addEventListener('click', initializeSimulation);

// 初期表示とアニメーションの準備
// ページロード時に一度だけ実行され、シミュレーションは「スタート」待ちの状態
initializeSimulation();
