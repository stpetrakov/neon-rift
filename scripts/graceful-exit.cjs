// Let native worker handles settle before Vinext exits after a successful Windows build.
const originalExit = process.exit.bind(process);
process.exit = function (code = 0) {
  if (code !== 0 || process.platform !== 'win32') return originalExit(code);
  process.exitCode = 0;
  setTimeout(() => originalExit(0), 1000);
};
