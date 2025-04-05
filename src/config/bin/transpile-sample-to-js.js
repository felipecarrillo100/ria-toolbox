#!/usr/bin/env node
/*
 *
 * Copyright (c) 1999-2025 Luciad All Rights Reserved.
 *
 * Luciad grants you ("Licensee") a non-exclusive, royalty free, license to use,
 * modify and redistribute this software in source and binary code form,
 * provided that i) this copyright notice and license appear on all copies of
 * the software; and ii) Licensee does not utilize the software in a manner
 * which is disparaging to Luciad.
 *
 * This software is provided "AS IS," without a warranty of any kind. ALL
 * EXPRESS OR IMPLIED CONDITIONS, REPRESENTATIONS AND WARRANTIES, INCLUDING ANY
 * IMPLIED WARRANTY OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE OR
 * NON-INFRINGEMENT, ARE HEREBY EXCLUDED. LUCIAD AND ITS LICENSORS SHALL NOT BE
 * LIABLE FOR ANY DAMAGES SUFFERED BY LICENSEE AS A RESULT OF USING, MODIFYING
 * OR DISTRIBUTING THE SOFTWARE OR ITS DERIVATIVES. IN NO EVENT WILL LUCIAD OR ITS
 * LICENSORS BE LIABLE FOR ANY LOST REVENUE, PROFIT OR DATA, OR FOR DIRECT,
 * INDIRECT, SPECIAL, CONSEQUENTIAL, INCIDENTAL OR PUNITIVE DAMAGES, HOWEVER
 * CAUSED AND REGARDLESS OF THE THEORY OF LIABILITY, ARISING OUT OF THE USE OF
 * OR INABILITY TO USE SOFTWARE, EVEN IF LUCIAD HAS BEEN ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGES.
 */

import * as babel from "@babel/core";
import path from "path";
import glob from "glob";
import fs from "fs";
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);

const sampleDir = process.cwd();

const transpileDir = path.resolve(sampleDir, "./transpiled")
if (fs.existsSync(transpileDir)) {
  fs.rmSync(transpileDir, {recursive: true});
}
fs.mkdirSync(transpileDir);

// transpile ts(x) files to js(x)
const tsFiles = glob.sync("**/*.ts?(x)",
    {ignore: ["*.d.ts.", "transpiled/**", "node_modules/**"], nodir: true, cwd: sampleDir});
for (const tsFile of tsFiles) {
  const result = babel.transform(
      fs.readFileSync(tsFile, "utf8"),
      {
        filename: tsFile,
        babelrc: false,
        configFile: require.resolve("@luciad/ria-toolbox-config/transpile-to-js.babelrc"),
      });
  const dest = path.resolve(transpileDir, tsFile.replace(".ts", ".js"));
  const destDir = path.dirname(dest);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, {recursive: true});
  }
  fs.writeFileSync(dest, result.code);
}

// copy all other files
const otherFiles = glob.sync("./**/*",
    {ignore: ["**/*.ts?(x)", "transpiled/**", "node_modules/**"], nodir: true, cwd: sampleDir});
for (const otherFile of otherFiles) {
  const dest = path.join(sampleDir, "transpiled", otherFile);
  const destDir = path.dirname(dest);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, {recursive: true});
  }
  fs.copyFileSync(otherFile, path.resolve(transpileDir, otherFile));
}

console.log(`Transpiled sample ${sampleDir} to JS in directory ${transpileDir}`);