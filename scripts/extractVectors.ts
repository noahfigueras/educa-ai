import cv from '@u4/opencv4nodejs';
import sharp from 'sharp';

async function main() {
  const imgPath = "./images/ficha-1749008241496-2704.6.png";
  const outFile = "all_matches.png";
  await sharp(imgPath)
    .extract({
      left: 868,
      top: 200,
      width: 350,
      height: 1400 
    })
    .toFile(outFile);

  const image = cv.imread(outFile).bgrToGray();
  const blurred = image.gaussianBlur(new cv.Size(5,5), 0);
  const thresh = blurred.threshold(200, 255, cv.THRESH_BINARY);
  const contours = thresh.findContours(cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
  
  const rectangles: any = [];
  for (const contour of contours) {
    const epsilon = 0.05 * contour.arcLength(true);
    const approx = contour.approxPolyDP(epsilon, true);

    if(approx.length == 4) {
      const rect = contour.boundingRect();
      if(rect.height > 100 && rect.height < 1000) {
        rectangles.push(rect);
      }
    }
  }
  // Sort by top position (y) to mantain vertical order
  rectangles.sort((a: any,b: any) => a.y - b.y);

  let count = 0;
  for (const rect of rectangles) {
    const nameOut = `./images/page-x-${count}`;
    await sharp(outFile)
      .extract({
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height 
      })
      .toFile(nameOut);
    count++;
  }
}

main();
