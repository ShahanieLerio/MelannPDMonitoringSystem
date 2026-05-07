const fs = require('fs');
const path = require('path');

const imgPath = path.join(__dirname, 'public', 'favicon.jpg');
const svgPath = path.join(__dirname, 'public', 'favicon.svg');

try {
    const imgData = fs.readFileSync(imgPath);
    const base64 = imgData.toString('base64');

    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <clipPath id="circleView">
      <circle cx="50" cy="50" r="49" />
    </clipPath>
  </defs>
  <image width="100" height="100" href="data:image/jpeg;base64,${base64}" clip-path="url(#circleView)" preserveAspectRatio="xMidYMid slice" />
</svg>`;

    fs.writeFileSync(svgPath, svgContent);
    console.log('SVG created successfully!');
} catch (e) {
    console.error(e);
}
