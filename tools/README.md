# 3D exercise figure

`js/fig3d.js` is built from `tools/fig3d.src.js` (three.js bundled in, moves.js and muscles.js kept external):

    npm i three@0.170.0 esbuild
    npx esbuild tools/fig3d.src.js --bundle --format=esm --minify --external:./moves.js --external:./muscles.js --outfile=js/fig3d.js

The app loads it only when a large demo is on screen (session, exercise page, roulette, editor). Phones without WebGL keep the 2D drawing.
