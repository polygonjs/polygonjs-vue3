const fs = require("fs");
const path = require("path");
const content = `declare module "@polygonjs/vue3";
`;
const currentPath = process.cwd();
const filePath = path.join(currentPath, "dist", "@polygonjs/vue3.common.d.ts");
fs.writeFileSync(filePath, content);
