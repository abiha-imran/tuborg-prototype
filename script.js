// === DOM ELEMENTS ===
const canvas = document.getElementById("beerCanvas");
const ctx = canvas.getContext("2d");

const startOverlay = document.getElementById("startOverlay");
const startBtn = document.getElementById("startExperience");

let video;
let w, h;
let running = false;

let prevFrame = null;
let bubbles = [];
let time = 0;

// Audio (must be a real file in your repo root: song.mp3)
const audio = new Audio("song.mp3");
audio.loop = true;
audio.preload = "auto";
audio.volume = 0.75;

// ================== CANVAS ==================
function resizeCanvas() {
  // keep your original full-screen behavior
  w = window.innerWidth;
  h = window.innerHeight;

  // set actual pixel size
  canvas.width = w;
  canvas.height = h;
}
window.addEventListener("resize", resizeCanvas);

// ================== START EXPERIENCE ==================
startBtn.addEventListener("click", async () => {
  // 1) Start audio (allowed because user clicked)
  try {
    await audio.play();
  } catch (e) {
    // If it fails, it’s usually because the file can’t be found or browser blocked it.
    console.warn("Audio did not start:", e);
  }

  // 2) Start camera
  startOverlay.style.display = "none";
  startCamera();
});

// ================== CAMERA ==================
function startCamera() {
  video = document.createElement("video");
  video.autoplay = true;
  video.playsInline = true;
  video.muted = true; // helps autoplay on some browsers

  navigator.mediaDevices
    .getUserMedia({ video: true })
    .then((stream) => {
      video.srcObject = stream;

      video.addEventListener("loadedmetadata", () => {
        running = true;
        resizeCanvas();
        draw();
      });
    })
    .catch((err) => {
      console.error("Camera error:", err);

      // If user blocks camera, show overlay again
      startOverlay.style.display = "grid";
      alert("Camera permission is required to run the experience.");
    });
}

// ================== MAIN LOOP ==================
function draw() {
  if (!running) return;
  time += 0.01;

  // --- 1. DRAW MIRRORED WEBCAM ---
  const waveX = Math.sin(time * 1.2) * 8;
  const waveY = Math.cos(time * 0.9) * 4;

  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.scale(-1, 1); // mirror horizontally
  ctx.translate(-w / 2 + waveX, -h / 2 + waveY);
  ctx.drawImage(video, 0, 0, w, h);
  ctx.restore();

  // --- 2. CONCERT-STYLE COLOR GRADING ---
  ctx.fillStyle = "rgba(0,0,0,0.65)";
  ctx.fillRect(0, 0, w, h);

  // Tuborg blue spotlight (left)
  let g1 = ctx.createRadialGradient(
    w * 0.25, h * 0.3, 0,
    w * 0.25, h * 0.3, w * 0.7
  );
  g1.addColorStop(0, "rgba(0, 190, 255, 0.35)");
  g1.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = g1;
  ctx.fillRect(0, 0, w, h);

  // Tuborg green spotlight (right)
  let g2 = ctx.createRadialGradient(
    w * 0.75, h * 0.4, 0,
    w * 0.75, h * 0.4, w * 0.7
  );
  g2.addColorStop(0, "rgba(0, 255, 150, 0.32)");
  g2.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, w, h);

  // Vignette
  let v = ctx.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w * 0.9);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,0.6)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);

  // --- 3. MOTION DETECTION ---
  const frame = ctx.getImageData(0, 0, w, h);
  if (prevFrame) detectMotion(frame);
  prevFrame = frame;

  // --- 4. UPDATE + DRAW BURSTS ---
  updateBubbles();
  drawBubbles();

  requestAnimationFrame(draw);
}

// ================== MOTION → LIGHT BURSTS ==================
function detectMotion(frame) {
  const step = 26;
  const threshold = 38;

  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const i = (y * w + x) * 4;
      const diff =
        Math.abs(frame.data[i] - prevFrame.data[i]) +
        Math.abs(frame.data[i + 1] - prevFrame.data[i + 1]) +
        Math.abs(frame.data[i + 2] - prevFrame.data[i + 2]);

      if (diff > threshold) spawnBubble(x, y, diff);
    }
  }
}

// ================== CREATE BURST ==================
function spawnBubble(x, y, diffValue) {
  const energy = Math.min(1, (diffValue - 35) / 120);

  const palette = [
    { r: 0, g: 255, b: 170 },
    { r: 0, g: 220, b: 255 },
    { r: 40, g: 190, b: 255 }
  ];

  let accent = null;
  if (energy > 0.7 && Math.random() < 0.25) {
    accent = { r: 255, g: 60, b: 200 };
  }

  const baseCol = palette[Math.floor(Math.random() * palette.length)];

  bubbles.push({
    x: x + (Math.random() - 0.5) * 14,
    y: y + (Math.random() - 0.5) * 14,
    r: 1.4 + energy * 6,
    life: 1,
    vy: -0.3 - energy * 0.9,
    drift: Math.random() * Math.PI * 2,
    energy,
    color: baseCol,
    accent
  });
}

// ================== UPDATE BURSTS ==================
function updateBubbles() {
  bubbles.forEach((b) => {
    b.y += b.vy;
    b.x += Math.sin(time + b.drift) * (0.5 + b.energy * 1.2);
    b.life -= 0.015 + b.energy * 0.02;
  });
  bubbles = bubbles.filter((b) => b.life > 0);
}

// ================== DRAW BURSTS ==================
function drawBubbles() {
  bubbles.forEach((b) => {
    const haloRadius = b.r * (4.5 + b.energy * 3);

    ctx.beginPath();
    ctx.fillStyle = `rgba(${b.color.r},${b.color.g},${b.color.b},${0.18 * b.life})`;
    ctx.arc(b.x, b.y, haloRadius, 0, Math.PI * 2);
    ctx.fill();

    if (b.accent) {
      ctx.beginPath();
      ctx.fillStyle = `rgba(${b.accent.r},${b.accent.g},${b.accent.b},${0.12 * b.life})`;
      ctx.arc(b.x, b.y, haloRadius * 1.3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.beginPath();
    ctx.fillStyle = `rgba(255,255,255,${0.65 * b.life})`;
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
  });
}
