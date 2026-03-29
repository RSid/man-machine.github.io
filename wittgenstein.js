let faceMesh;
let video;
let faces = [];
let options = { maxFaces: 2, refineLandmarks: false, flipHorizontal: false };

let handPose;
let hands = [];

let depthEstimator;
let depthMap;

let textX;
let textY;
let duration = 0;
let count = 0;
let poesry =["5.6 The limits of my language mean the limits of my world. ", 
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
    "6.36311 That the sun will rise to-morrow, is an hypothesis; and that means that we do not know whether it will rise. ","6.421 It is clear that ethics cannot be expressed. Ethics is transcendental. (Ethics and aesthetics are one.)",
    "6.4311 Our life is endless in the way that our visual field is without limit.",
    "6.4312 The temporal immortality of the human soul, that is to say, its eternal survival after death, is not only in no way guaranteed, but this assumption in the first place will not do for us what we always tried to make it do. Is a riddle solved by the fact that I survive for ever? Is this eternal life not as enigmatic as our present one?",
    "7 Whereof one cannot speak, thereof one must be silent."];

function preload() {
  // Load the models
  faceMesh = ml5.faceMesh(options);
  handPose = ml5.handPose();
  depthEstimator = ml5.depthEstimation();
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  // Create the webcam video and hide it
  video = createCapture(VIDEO);
  video.size(windowWidth, windowHeight);
  video.hide();
  
  // Start detecting
  faceMesh.detectStart(video, gotFaces);
  handPose.detectStart(video, gotHands);
  depthEstimator.estimateStart(video, gotResults);
}

function draw() {
  // Draw the webcam video
  background(0)
  
  // If depth estimation results are available
  if (depthMap) {
    // Draw the depth map
    image(depthMap.image, 0, 0);
  }
  
  // draw hands
  for (let i = 0; i < hands.length; i++) {
    let hand = hands[i];
    for (let j = 0; j < hand.keypoints.length; j++) {
      let keypoint = hand.keypoints[j];
      fill(32, 200, 150);
      noStroke();
      circle(keypoint.x, keypoint.y, 10);
    }
  }

  // Draw faces
  for (let i = 0; i < faces.length; i++) {
    let face = faces[i];
    for (let j = 0; j < face.keypoints.length; j++) {
      let keypoint = face.keypoints[j];
      fill(200, 50, 130);
      noStroke();
      circle(keypoint.x, keypoint.y, 5);
    }
     }
  
  textSize(14);
  textWrap(WORD);
  textFont('Monospace');
  fill(255);
  text(poesry[count],textX, textY, 200)
  if (frameCount % 60 == 0) { // if the frameCount is divisible by 60, then a second has passed. 
        if (duration < 2) {
            duration ++;
        } else {
            count ++;
            duration = 0;
            textX = random(10,windowWidth-250);
            textY = random(100,windowHeight-450);
            if (count == poesry.length) {
                count = 0
            } 
        }
    }
}

function gotFaces(results) {
  // Save the output to the faces variable
  faces = results;
}

function gotHands(results) {
  // save the output to the hands variable
  hands = results;
}

function gotResults(result) {
  // Store the latest result in the global variable depthMap
  depthMap = result;
}