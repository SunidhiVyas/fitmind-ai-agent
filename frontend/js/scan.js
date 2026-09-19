/* ============================================================
   FITMIND AI — LIVE BODY SCAN
============================================================ */

const API_BASE = window.FITMIND_API || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:4000' : '');


let video;
let canvas;
let ctx;

let detector = null;
let animationFrame = null;

let stream = null;

let scanning = false;
let scanStarted = false;

let scanStartTime = 0;

const SCAN_DURATION = 9000;


/* ============================================================
   ELEMENTS
============================================================ */

document.addEventListener(
    'DOMContentLoaded',
    async () => {

        video =
            document.getElementById('video');

        canvas =
            document.getElementById('output');

        ctx =
            canvas.getContext('2d');

        setupButtons();

        await startCamera();

        await loadPoseModel();

    }
);


/* ============================================================
   BUTTONS
============================================================ */

function setupButtons() {

    const backButton =
        document.getElementById(
            'backButton'
        );

    const scanButton =
        document.getElementById(
            'scanBtn'
        );

    const stopButton =
        document.getElementById(
            'stopBtn'
        );

    const runAgainButton =
        document.getElementById(
            'runAgainButton'
        );


    backButton?.addEventListener(
        'click',
        () => {

            window.location.href =
                'index.html';

        }
    );


    scanButton?.addEventListener(
        'click',
        () => {

            startScan();

        }
    );


    stopButton?.addEventListener(
        'click',
        () => {

            stopScan();

        }
    );


    runAgainButton?.addEventListener(
        'click',
        () => {

            document
                .getElementById('scanResults')
                ?.scrollIntoView({
                    behavior: 'smooth'
                });

            startScan();

        }
    );

}


/* ============================================================
   CAMERA
============================================================ */

async function startCamera() {

    try {

        setStatus(
            'STARTING CAMERA',
            true
        );


        stream =
            await navigator.mediaDevices.getUserMedia(
                {
                    video: {
                        facingMode: 'user',
                        width: {
                            ideal: 1280
                        },
                        height: {
                            ideal: 720
                        }
                    },

                    audio: false
                }
            );


        video.srcObject =
            stream;


        await video.play();


        canvas.width =
            video.videoWidth;

        canvas.height =
            video.videoHeight;


        setStatus(
            'CAMERA READY',
            true
        );


        setMessage(
            'Stand where your full body is visible.'
        );


    } catch (error) {

        console.error(
            'Camera error:',
            error
        );


        setStatus(
            'CAMERA ERROR',
            false
        );


        setMessage(
            'Camera permission is required to run the body scan.'
        );

    }

}


/* ============================================================
   LOAD MOVENET
============================================================ */

async function loadPoseModel() {

    try {

        setStatus(
            'LOADING AI MODEL',
            true
        );


        detector =
            await poseDetection.createDetector(
                poseDetection.SupportedModels.MoveNet,
                {
                    modelType:
                        poseDetection.movenet.modelType.SINGLEPOSE_THUNDER
                }
            );


        setStatus(
            'AI READY',
            true
        );


        setMessage(
            'Camera and AI model ready. Click RUN LIVE SCAN.'
        );


        requestAnimationFrame(
            detectPose
        );


    } catch (error) {

        console.error(
            'MoveNet error:',
            error
        );


        setStatus(
            'AI MODEL ERROR',
            false
        );

    }

}


/* ============================================================
   POSE DETECTION
============================================================ */

async function detectPose() {

    if (
        !detector ||
        !video ||
        video.readyState < 2
    ) {

        animationFrame =
            requestAnimationFrame(
                detectPose
            );

        return;

    }


    try {

        const poses =
            await detector.estimatePoses(
                video
            );


        ctx.clearRect(
            0,
            0,
            canvas.width,
            canvas.height
        );


        if (
            poses &&
            poses.length
        ) {

            drawPose(
                poses[0]
            );


            if (scanning) {

                updateLiveMetrics(
                    poses[0]
                );

            }

        }


    } catch (error) {

        console.error(
            'Pose detection error:',
            error
        );

    }


    animationFrame =
        requestAnimationFrame(
            detectPose
        );

}


/* ============================================================
   DRAW POSE
============================================================ */

function drawPose(
    pose
) {

    if (
        !pose ||
        !pose.keypoints
    ) {
        return;
    }


    const keypoints =
        pose.keypoints;


    ctx.fillStyle =
        '#00ffd5';


    keypoints.forEach(
        point => {

            if (
                point.score &&
                point.score > 0.35
            ) {

                ctx.beginPath();

                ctx.arc(
                    point.x,
                    point.y,
                    5,
                    0,
                    Math.PI * 2
                );

                ctx.fill();

            }

        }
    );


    const connections = [

        ['left_shoulder', 'right_shoulder'],

        ['left_shoulder', 'left_elbow'],

        ['left_elbow', 'left_wrist'],

        ['right_shoulder', 'right_elbow'],

        ['right_elbow', 'right_wrist'],

        ['left_shoulder', 'left_hip'],

        ['right_shoulder', 'right_hip'],

        ['left_hip', 'right_hip'],

        ['left_hip', 'left_knee'],

        ['left_knee', 'left_ankle'],

        ['right_hip', 'right_knee'],

        ['right_knee', 'right_ankle']

    ];


    ctx.strokeStyle =
        'rgba(0,255,213,.7)';

    ctx.lineWidth =
        3;


    connections.forEach(
        connection => {

            const a =
                keypoints.find(
                    p =>
                        p.name ===
                        connection[0]
                );

            const b =
                keypoints.find(
                    p =>
                        p.name ===
                        connection[1]
                );


            if (
                a &&
                b &&
                a.score > 0.35 &&
                b.score > 0.35
            ) {

                ctx.beginPath();

                ctx.moveTo(
                    a.x,
                    a.y
                );

                ctx.lineTo(
                    b.x,
                    b.y
                );

                ctx.stroke();

            }

        }
    );

}


/* ============================================================
   LIVE METRICS
============================================================ */

function updateLiveMetrics(
    pose
) {

    const keypoints =
        pose.keypoints;


    const score =
        calculatePoseConfidence(
            keypoints
        );


    const posture =
        calculatePosture(
            keypoints
        );


    const balance =
        calculateBalance(
            keypoints
        );


    const symmetry =
        calculateSymmetry(
            keypoints
        );


    const mobility =
        calculateMobility(
            keypoints
        );


    setMetric(
        'livePosture',
        posture
    );

    setMetric(
        'liveBalance',
        balance
    );

    setMetric(
        'liveSymmetry',
        symmetry
    );

    setMetric(
        'liveMobility',
        mobility
    );

}


/* ============================================================
   METRIC HELPERS
============================================================ */

function setMetric(
    id,
    value
) {

    const element =
        document.getElementById(id);

    if (!element) {
        return;
    }


    element.textContent =
        `${Math.round(value)}%`;

}


/* ============================================================
   POSE CONFIDENCE
============================================================ */

function calculatePoseConfidence(
    keypoints
) {

    const valid =
        keypoints.filter(
            point =>
                point.score &&
                point.score > 0.3
        );


    if (!valid.length) {
        return 0;
    }


    const average =
        valid.reduce(
            (sum, point) =>
                sum + point.score,
            0
        ) /
        valid.length;


    return clamp(
        average * 100,
        0,
        100
    );

}


/* ============================================================
   POSTURE
============================================================ */

function calculatePosture(
    keypoints
) {

    const leftShoulder =
        getPoint(
            keypoints,
            'left_shoulder'
        );

    const rightShoulder =
        getPoint(
            keypoints,
            'right_shoulder'
        );

    const leftHip =
        getPoint(
            keypoints,
            'left_hip'
        );

    const rightHip =
        getPoint(
            keypoints,
            'right_hip'
        );


    if (
        !leftShoulder ||
        !rightShoulder ||
        !leftHip ||
        !rightHip
    ) {

        return 0;

    }


    const shoulderTilt =
        Math.abs(
            leftShoulder.y -
            rightShoulder.y
        );


    const hipTilt =
        Math.abs(
            leftHip.y -
            rightHip.y
        );


    const penalty =
        Math.min(
            50,
            (shoulderTilt + hipTilt) /
            5
        );


    return clamp(
        100 - penalty,
        0,
        100
    );

}


/* ============================================================
   BALANCE
============================================================ */

function calculateBalance(
    keypoints
) {

    const leftHip =
        getPoint(
            keypoints,
            'left_hip'
        );

    const rightHip =
        getPoint(
            keypoints,
            'right_hip'
        );


    if (
        !leftHip ||
        !rightHip
    ) {

        return 0;

    }


    const difference =
        Math.abs(
            leftHip.x -
            rightHip.x
        );


    const normalized =
        Math.min(
            difference / 100,
            1
        );


    return clamp(
        100 -
        normalized * 50,
        0,
        100
    );

}


/* ============================================================
   SYMMETRY
============================================================ */

function calculateSymmetry(
    keypoints
) {

    const pairs = [

        [
            'left_shoulder',
            'right_shoulder'
        ],

        [
            'left_elbow',
            'right_elbow'
        ],

        [
            'left_hip',
            'right_hip'
        ],

        [
            'left_knee',
            'right_knee'
        ]

    ];


    let total =
        0;

    let count =
        0;


    pairs.forEach(
        pair => {

            const left =
                getPoint(
                    keypoints,
                    pair[0]
                );

            const right =
                getPoint(
                    keypoints,
                    pair[1]
                );


            if (
                left &&
                right
            ) {

                const difference =
                    Math.abs(
                        left.y -
                        right.y
                    );


                const score =
                    clamp(
                        100 -
                        difference / 3,
                        0,
                        100
                    );


                total +=
                    score;

                count++;

            }

        }
    );


    return count
        ? total / count
        : 0;

}


/* ============================================================
   MOBILITY
============================================================ */

function calculateMobility(
    keypoints
) {

    const shoulders =
        getPoint(
            keypoints,
            'left_shoulder'
        );

    const hips =
        getPoint(
            keypoints,
            'left_hip'
        );

    const knees =
        getPoint(
            keypoints,
            'left_knee'
        );


    if (
        !shoulders ||
        !hips ||
        !knees
    ) {

        return 0;

    }


    const torso =
        Math.abs(
            hips.y -
            shoulders.y
        );


    const leg =
        Math.abs(
            knees.y -
            hips.y
        );


    const movement =
        torso +
        leg;


    return clamp(
        50 +
        movement / 8,
        0,
        100
    );

}


/* ============================================================
   START SCAN
============================================================ */

function startScan() {

    if (
        scanning
    ) {
        return;
    }


    if (
        !detector
    ) {

        setMessage(
            'AI model is still loading.'
        );

        return;

    }


    scanning =
        true;

    scanStarted =
        true;

    scanStartTime =
        performance.now();


    document
        .getElementById(
            'scanBtn'
        )
        ?.setAttribute(
            'disabled',
            'disabled'
        );


    document
        .getElementById(
            'scanResults'
        )
        ?.classList.remove(
            'visible'
        );


    setStatus(
        'SCANNING',
        true
    );


    setMessage(
        'Move naturally while FitMind analyzes your body.'
    );


    updateProgress();

}


/* ============================================================
   PROGRESS
============================================================ */

function updateProgress() {

    if (!scanning) {
        return;
    }


    const elapsed =
        performance.now() -
        scanStartTime;


    const percentage =
        Math.min(
            100,
            (elapsed /
                SCAN_DURATION) *
            100
        );


    const bar =
        document.getElementById(
            'scanProgressBar'
        );


    const text =
        document.getElementById(
            'scanProgressText'
        );


    if (bar) {

        bar.style.width =
            `${percentage}%`;

    }


    if (text) {

        text.textContent =
            `${Math.round(percentage)}%`;

    }


    if (
        percentage >= 100
    ) {

        finishScan();

        return;

    }


    requestAnimationFrame(
        updateProgress
    );

}


/* ============================================================
   FINISH SCAN
============================================================ */

async function finishScan() {

    scanning =
        false;


    setStatus(
        'SCAN COMPLETE',
        true
    );


    setMessage(
        'Body analysis complete.'
    );


    const posture =
        Number(
            document
                .getElementById(
                    'livePosture'
                )
                ?.textContent
                ?.replace(
                    '%',
                    ''
                )
        ) || 0;


    const balance =
        Number(
            document
                .getElementById(
                    'liveBalance'
                )
                ?.textContent
                ?.replace(
                    '%',
                    ''
                )
        ) || 0;


    const symmetry =
        Number(
            document
                .getElementById(
                    'liveSymmetry'
                )
                ?.textContent
                ?.replace(
                    '%',
                    ''
                )
        ) || 0;


    const mobility =
        Number(
            document
                .getElementById(
                    'liveMobility'
                )
                ?.textContent
                ?.replace(
                    '%',
                    ''
                )
        ) || 0;


    const score =
        Math.round(
            (
                posture +
                balance +
                symmetry +
                mobility
            ) / 4
        );


    const scan = {

        score,

        confidence: 90,

        model:
            'MoveNet Thunder',

        metrics: {

            posture,

            balance,

            symmetry,

            mobility

        },

        muscles: {

            shoulders:
                posture,

            arms:
                mobility,

            core:
                balance,

            legs:
                mobility

        },

        timestamp:
            new Date().toISOString()

    };


    showResults(
        scan
    );


    await saveScan(
        scan
    );


    document
        .getElementById(
            'scanBtn'
        )
        ?.removeAttribute(
            'disabled'
        );

}


/* ============================================================
   SHOW RESULTS
============================================================ */

function showResults(
    scan
) {

    setText(
        'resultScore',
        scan.score
    );

    setText(
        'resultPosture',
        `${scan.metrics.posture}%`
    );

    setText(
        'resultBalance',
        `${scan.metrics.balance}%`
    );

    setText(
        'resultSymmetry',
        `${scan.metrics.symmetry}%`
    );

    setText(
        'resultMobility',
        `${scan.metrics.mobility}%`
    );

    setText(
        'resultConfidence',
        `${scan.confidence}%`
    );


    setText(
        'resultShoulders',
        `${scan.muscles.shoulders}%`
    );

    setText(
        'resultArms',
        `${scan.muscles.arms}%`
    );

    setText(
        'resultCore',
        `${scan.muscles.core}%`
    );

    setText(
        'resultLegs',
        `${scan.muscles.legs}%`
    );


    const results =
        document.getElementById(
            'scanResults'
        );


    if (results) {

        results.classList.add(
            'visible'
        );


        results.scrollIntoView({
            behavior: 'smooth'
        });

    }

}


/* ============================================================
   SAVE SCAN
============================================================ */

async function saveScan(
    scan
) {

    try {

        const response =
            await fetch(
                `${API_BASE}/api/scan`,
                {

                    method: 'POST',

                    headers: {
                        'Content-Type':
                            'application/json'
                    },

                    body:
                        JSON.stringify(
                            scan
                        )

                }
            );


        const data =
            await response.json();


        console.log(
            'Body scan saved:',
            data
        );


        localStorage.setItem(
            'fitmind.bodyState',
            JSON.stringify({
                hasScan: true,
                latestScan: scan,
                latestBodyScan: scan,
                totalScans:
                    data.totalScans || 1,
                lastUpdated:
                    scan.timestamp
            })
        );


    } catch (error) {

        console.error(
            'Could not save scan:',
            error
        );


        /*
           Keep local copy even if backend
           is temporarily unavailable.
        */

        localStorage.setItem(
            'fitmind.bodyState',
            JSON.stringify({
                hasScan: true,
                latestScan: scan,
                latestBodyScan: scan,
                totalScans: 1,
                lastUpdated:
                    scan.timestamp
            })
        );

    }

}


/* ============================================================
   STOP
============================================================ */

function stopScan() {

    scanning =
        false;


    setStatus(
        'SCAN STOPPED',
        false
    );


    setMessage(
        'Scan stopped. Click RUN LIVE SCAN to start again.'
    );


    document
        .getElementById(
            'scanBtn'
        )
        ?.removeAttribute(
            'disabled'
        );

}


/* ============================================================
   HELPERS
============================================================ */

function getPoint(
    keypoints,
    name
) {

    const point =
        keypoints.find(
            item =>
                item.name === name
        );


    if (
        !point ||
        !point.score ||
        point.score < 0.3
    ) {

        return null;

    }


    return point;

}


function clamp(
    value,
    min,
    max
) {

    return Math.max(
        min,
        Math.min(
            max,
            value
        )
    );

}


function setText(
    id,
    value
) {

    const element =
        document.getElementById(
            id
        );


    if (element) {

        element.textContent =
            value;

    }

}


function setStatus(
    text,
    active
) {

    const statusText =
        document.getElementById(
            'statusText'
        );

    const dot =
        document.getElementById(
            'statusDot'
        );


    if (statusText) {

        statusText.textContent =
            text;

    }


    if (dot) {

        dot.classList.toggle(
            'active',
            active
        );

    }

}


function setMessage(
    message
) {

    const element =
        document.getElementById(
            'scanMessage'
        );


    if (element) {

        element.textContent =
            message;

    }

}


/* ============================================================
   CLEANUP
============================================================ */

window.addEventListener(
    'beforeunload',
    () => {

        if (stream) {

            stream
                .getTracks()
                .forEach(
                    track =>
                        track.stop()
                );

        }


        if (animationFrame) {

            cancelAnimationFrame(
                animationFrame
            );

        }

    }
);