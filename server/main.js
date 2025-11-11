// If some platform still runs `node main.js`, this will forward to the built file.
try {
  require('./dist/index.js');
} catch (err) {
  console.error('Cannot find dist/index.js. Did you run "npm run build"?');
  console.error(err);
  process.exit(1);
}
