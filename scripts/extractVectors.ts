import cv from '@u4/opencv4nodejs';
import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';

const folderPath = './images';
const imageExtensions = ['.png', '.jpg'];

 fs.readdir(folderPath, async (err, files) => {
   if (err) {
     console.error('Error reading folder:', err);
     return;
   }

   const images = files.filter(file =>
     imageExtensions.includes(path.extname(file).toLowerCase())
   );

   for (const image of images) {
     const fullPath = path.join(folderPath, image);
     await cropImage(fullPath);
   }
 });

async function cropImage(imgPath: string) {
  const nameOut = imgPath.replace("ficha", `test`)
  console.log("Writing to", nameOut);
  await sharp(imgPath)
  .extract({
    left: 868,
    top: 200,
    width: 350,
    height: 1400 
  })
  .toFile(nameOut);
}

async function main(imgPath: string) {
  const buffer = await sharp(imgPath)
  .extract({
    left: 868,
    top: 300,
    width: 350,
    height: 1400 
  })
  .toBuffer();

  const image = cv.imdecode(buffer).bgrToGray();
  const blurred = image.gaussianBlur(new cv.Size(5,5), 0);
  const thresh = blurred.threshold(240, 255, cv.THRESH_BINARY);

  // Invert image to detect black shapes
  const inverted = thresh.bitwiseNot();

  // Step 3: Edge detection
  const edges = thresh.canny(50, 150);

  // Step 4: Hough line detection and redrawing
  const kernel = new cv.Mat([
    [0, 1, 0],
    [1, 1, 1],
    [0, 1, 0]
  ], cv.CV_8U);
  const dilated = edges.dilate(kernel, new cv.Point2(-1, -1), 2);
  const lines = dilated.houghLinesP(1, Math.PI / 180, 30, 20, 10);

  // Draw Hough lines onto a blank canvas
  //const canvas = new cv.Mat(image.rows, image.cols, cv.CV_8UC1, 0);
  for (const line of lines) {
    const [x1, y1, x2, y2] = [line.at(0), line.at(1), line.at(2), line.at(3)];
    const length = Math.hypot(x2 - x1, y2 - y1);
    if (length > 20) {
      image.drawLine(new cv.Point2(x1, y1), new cv.Point2(x2, y2), new cv.Vec3(0,0,255), 5);
      //canvas.drawLine(new cv.Point2(x1, y1), new cv.Point2(x2, y2), new cv.Vec3(255, 255, 255), 10);
    }
  }

  // Step 5: Find contours on reinforced image
  const contours = image.findContours(cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
  const rectangles: any = [];
  for (const contour of contours) {
    const epsilon = 0.03 * contour.arcLength(true);
    const approx = contour.approxPolyDP(epsilon, true);
    const rect = contour.boundingRect();
    const condition = rect.height > 100 && rect.height < 1000 && rect.width > 100;

    if(rect.height > 1000) {
      rectangles.push(rect);
    }
  }

  // Sort by top position (y) to mantain vertical order
  rectangles.sort((a: any,b: any) => a.y - b.y);

  let count = 0;
  for (const rect of rectangles) {
    const nameOut = imgPath.replace("ficha", `test`)
    console.log("Writing to", nameOut);
    await sharp(buffer)
    .extract({
      left: rect.x,
      top: rect.y,
      width: rect.width,
      height: rect.height 
    })
    .toFile(nameOut);
    count++;
  }
  if(count != 1) {
    console.log(`Image ${imgPath} not parsed correctly`)
  }
}

async function detectAndCircleGraphics(imgPath: string) {
  const buffer = await sharp(imgPath)
  .extract({
    left: 868,
    top: 200,
    width: 350,
    height: 1400 
  })
  .toBuffer();
  const image = cv.imdecode(buffer);
  const hsv = image.cvtColor(cv.COLOR_BGR2HSV);

  const lowerColor = new cv.Vec3(30, 10, 100);  // H, S, V
  const upperColor = new cv.Vec3(90, 100, 255);

  // Black (low saturation and value)
  const lowerBlack = new cv.Vec3(0, 0, 0);
  const upperBlack = new cv.Vec3(180, 255, 50);
  
  // Blue
  const lowerBlue = new cv.Vec3(100, 150, 50);
  const upperBlue = new cv.Vec3(140, 255, 255);
  
  // Red has two ranges in HSV
  const lowerRed1 = new cv.Vec3(0, 120, 70);
  const upperRed1 = new cv.Vec3(10, 255, 255);
  
  const lowerRed2 = new cv.Vec3(170, 120, 70);
  const upperRed2 = new cv.Vec3(180, 255, 255);

  const blackMask = hsv.inRange(lowerBlack, upperBlack);
  const blueMask = hsv.inRange(lowerBlue, upperBlue);
  const redMask1 = hsv.inRange(lowerRed1, upperRed1);
  const redMask2 = hsv.inRange(lowerRed2, upperRed2);
  const mask = hsv.inRange(lowerColor, upperColor)
    .bitwiseOr(blackMask)
    .bitwiseOr(blueMask)
    .bitwiseOr(redMask1)
    .bitwiseOr(redMask2)

  // // Optional: make background white instead of black
  const colorOnly = new cv.Mat(image.rows, image.cols, cv.CV_8UC3);
  colorOnly.setTo(new cv.Vec3(0, 0, 0));
  image.copyTo(colorOnly, mask);

  // Convert to grayscale and threshold
  const gray = colorOnly.bgrToGray();
  const thresh = gray.threshold(10, 255, cv.THRESH_BINARY);

  // Morphological closing to fill small gaps
  const kernel = new cv.Mat([
      [1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1],
          [1, 1, 1, 1, 1],
            [1, 1, 1, 1, 1],
              [1, 1, 1, 1, 1],
  ], cv.CV_8U);

  const closed = thresh.morphologyEx(kernel, cv.MORPH_CLOSE, new cv.Point2(-1, -1), 3);
  const contours = closed.findContours(cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

  // Draw bounding boxes
  const rectangles: any = [];
  for (const contour of contours) {
    const rect = contour.boundingRect();

    // Optional: Filter by size to avoid small noise
    if (rect.height > 1000) {
      rectangles.push(rect);
      colorOnly.drawRectangle(
        new cv.Point2(rect.x, rect.y),
        new cv.Point2(rect.x + rect.width, rect.y + rect.height),
        new cv.Vec3(0, 255, 0), // Green
        3
      );
    }
  }

  // Sort by top position (y) to mantain vertical order
  /*
  rectangles.sort((a: any,b: any) => a.y - b.y);
  let count = 0;
  for (const rect of rectangles) {
    const nameOut = imgPath.replace("ficha", `test-${count}-`)
    //const padding = 20;
    await sharp(buffer)
      .extract({
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height 
      })
      .toFile(nameOut);
    count++;
  }*/
  // Save the result
  const nameOut = imgPath.replace("ficha", `test`)
  console.log("Writing to", nameOut);
  cv.imwrite(nameOut, colorOnly);
}
//detectAndCircleGraphics("images/ficha-1749108946220-6338.26.png");
//main("images/ficha-1749108946220-6338.26.png");
