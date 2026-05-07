let faceMesh;
let video;
let faces = [];
let options = { maxFaces: 5, refineLandmarks: false, flipHorizontal: false };

let handPose;
let hands = [];

let depthEstimator;
let depthMap;

// Cover-fit transform, recomputed each frame from the live video size
let coverScale = 1;
let coverOffsetX = 0;
let coverOffsetY = 0;

let textX;
let textY;
let duration = 0;
let count = 0;
let poesry = [
  "5.6 The limits of my language mean the limits of my world. ",
  "5.61 Logic fills the world: the limits of the world are also its limits.",
  "5.62 This remark provides a key to the question, to what extent solipsism is a truth. In fact what solipsism means, is quite correct, only it cannot be said, but it shows itself. That the world is my world, shows itself in the fact that the limits of the language (the language which I understand) mean the limits of my world.",
  "5.621 The world and life are one.",
  "5.63 I am my world. (The microcosm.)",
  "5.631 The thinking, presenting subject; there is no such thing.",
  "5.632 The subject does not belong to the world but it is a limit of the world.",
  "5.633 Where in the world is a metaphysical subject to be noted?",
  "5.634 This is connected with the fact that no part of our experience is also a priori. Everything we see could also be otherwise. Everything we can describe at all could also be otherwise.",
  "5.64 Here we see that solipsism strictly carried out coincides with pure realism. The I in solipsism shrinks to an extensionless point and there remains the reality co-ordinated with it.",
  "6.1 The propositions of logic are tautologies.",
  "6.11 The propositions of logic therefore say nothing. (They are the analytical propositions.)",
  "6.13 Logic is not a theory but a reflexion of the world. Logic is transcendental.",
  "6.21 Mathematical propositions express no thoughts.",
  "6.3631 This process, however, has no logical foundation but only a psychological one. It is clear that there are no grounds for believing that the simplest course of events will really happen.",
  "6.36311 That the sun will rise to-morrow, is an hypothesis; and that means that we do not know whether it will rise. ",
  "6.421 It is clear that ethics cannot be expressed. Ethics is transcendental. (Ethics and aesthetics are one.)",
  "6.4311 Our life is endless in the way that our visual field is without limit.",
  "6.4312 The temporal immortality of the human soul, that is to say, its eternal survival after death, is not only in no way guaranteed, but this assumption in the first place will not do for us what we always tried to make it do. Is a riddle solved by the fact that I survive for ever? Is this eternal life not as enigmatic as our present one?",
  "7 Whereof one cannot speak, thereof one must be silent.",
];

function preload() {
  faceMesh = ml5.faceMesh(options);
  handPose = ml5.handPose();
  depthEstimator = ml5.depthEstimation();
}

function setup() {
  createCanvas(windowWidth, windowHeight);

  // Let the browser deliver a native webcam resolution rather than forcing
  // window dimensions, which causes letterboxing on wide monitors.
  video = createCapture({
    video: { width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
  });
  video.hide();

  faceMesh.detectStart(video, gotFaces);
  handPose.detectStart(video, gotHands);
  depthEstimator.estimateStart(video, gotResults);

  textX = random(10, windowWidth - 250);
  textY = random(100, windowHeight - 450);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function draw() {
  background(0);

  // Don't draw anything until the webcam is actually streaming
  if (!video.width || !video.height) return;

  // Cover-fit transform: scale video space to fill the canvas, crop overflow.
  // ml5's depth map and detection keypoints are all in video coordinates.
  coverScale = max(width / video.width, height / video.height);
  const drawW = video.width * coverScale;
  const drawH = video.height * coverScale;
  coverOffsetX = (width - drawW) / 2;
  coverOffsetY = (height - drawH) / 2;

  // Mirror everything so it reads like a mirror, not a camera
  push();
  translate(width, 0);
  scale(-1, 1);

  // Inside the mirrored space, the cover offset measured from the right edge
  // is the same as coverOffsetX from the left in unmirrored space.
  if (depthMap && depthMap.image) {
    drawDepthMapWithSoftEdge(
      depthMap.image,
      coverOffsetX,
      coverOffsetY,
      drawW,
      drawH,
    );
  }

  // Apply video-space transform for keypoints
  translate(coverOffsetX, coverOffsetY);
  scale(coverScale);

  // Hands
  for (let i = 0; i < hands.length; i++) {
    const hand = hands[i];
    for (let j = 0; j < hand.keypoints.length; j++) {
      const kp = hand.keypoints[j];
      fill(32, 200, 150);
      noStroke();
      circle(kp.x, kp.y, 10 / coverScale);
    }
  }

  // Faces (already deduplicated in gotFaces)
  for (let i = 0; i < faces.length; i++) {
    const face = faces[i];
    for (let j = 0; j < face.keypoints.length; j++) {
      const kp = face.keypoints[j];
      fill(200, 50, 130);
      noStroke();
      circle(kp.x, kp.y, 5 / coverScale);
    }
  }

  pop();

  // Text stays in canvas space, unmirrored, so it reads normally
  textSize(14);
  textWrap(WORD);
  textFont("Monospace");
  fill(255);
  text(poesry[count], textX, textY, 200);

  if (frameCount % 60 == 0) {
    if (duration < 2) {
      duration++;
    } else {
      count++;
      duration = 0;
      textX = random(10, windowWidth - 250);
      textY = random(100, windowHeight - 450);
      if (count == poesry.length) {
        count = 0;
      }
    }
  }
}

// ---- Depth map: threshold + feather to remove white halo on fast motion ----
// Soft-ramps low-luminance depth pixels to transparent so the silhouette edge
// fades into the black background instead of cutting off mid-gradient.
function drawDepthMapWithSoftEdge(img, dx, dy, dw, dh) {
  img.loadPixels();
  const px = img.pixels;
  if (px && px.length > 0) {
    // Tweak THRESHOLD (where the body "starts") and RAMP (edge softness) to taste.
    const THRESHOLD = 70;
    const RAMP = 50;
    for (let i = 0; i < px.length; i += 4) {
      const v = px[i]; // depth model output is grayscale, so R = G = B
      let t = (v - THRESHOLD) / RAMP;
      if (t < 0) t = 0;
      else if (t > 1) t = 1;
      // Leave RGB alone — only alpha fades. Preserves full depth-gradient
      // definition inside the silhouette; edge softly fades to transparent.
      px[i + 3] = 255 * t;
    }
    img.updatePixels();
  }
  image(img, dx, dy, dw, dh);
}

// ---- Face detection callback with IoU deduplication ----
// Supports an arbitrary number of faces; just removes overlapping double-detections.
function gotFaces(results) {
  faces = dedupeFaces(results, 0.4);
}

function dedupeFaces(results, iouThreshold) {
  const kept = [];
  for (const f of results) {
    const box = getFaceBox(f);
    if (!box) {
      kept.push(f);
      continue;
    }
    let isDup = false;
    for (const k of kept) {
      const kbox = getFaceBox(k);
      if (kbox && iou(box, kbox) > iouThreshold) {
        isDup = true;
        break;
      }
    }
    if (!isDup) kept.push(f);
  }
  return kept;
}

// ml5 FaceMesh usually exposes .box, but fall back to computing one from keypoints.
function getFaceBox(face) {
  if (face.box && face.box.width != null) {
    return {
      xMin: face.box.xMin,
      yMin: face.box.yMin,
      width: face.box.width,
      height: face.box.height,
    };
  }
  if (!face.keypoints || face.keypoints.length === 0) return null;
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const kp of face.keypoints) {
    if (kp.x < minX) minX = kp.x;
    if (kp.y < minY) minY = kp.y;
    if (kp.x > maxX) maxX = kp.x;
    if (kp.y > maxY) maxY = kp.y;
  }
  return { xMin: minX, yMin: minY, width: maxX - minX, height: maxY - minY };
}

function iou(a, b) {
  const ax2 = a.xMin + a.width;
  const ay2 = a.yMin + a.height;
  const bx2 = b.xMin + b.width;
  const by2 = b.yMin + b.height;
  const ix1 = Math.max(a.xMin, b.xMin);
  const iy1 = Math.max(a.yMin, b.yMin);
  const ix2 = Math.min(ax2, bx2);
  const iy2 = Math.min(ay2, by2);
  const iw = Math.max(0, ix2 - ix1);
  const ih = Math.max(0, iy2 - iy1);
  const inter = iw * ih;
  const uni = a.width * a.height + b.width * b.height - inter;
  return uni > 0 ? inter / uni : 0;
}

function gotHands(results) {
  hands = results;
}

function gotResults(result) {
  depthMap = result;
}
