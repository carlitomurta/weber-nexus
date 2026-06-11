const path = require("node:path");

module.exports = (options) => ({
  ...options,
  externals: [externalizeNodeModule],
});

function externalizeNodeModule({ request }, callback) {
  if (
    !request ||
    request.startsWith(".") ||
    request.startsWith("@weber-nexus/") ||
    path.isAbsolute(request)
  ) {
    callback();
    return;
  }

  callback(null, `commonjs ${request}`);
}
