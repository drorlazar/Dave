// global_setup.js - Builds the flat fixture folder the specs load files from

import * as fs from 'fs';
import * as path from 'path';
import { TEST_CONFIG, EXAMPLES_DIR } from './test_config.js';

// Specs refer to fixtures by bare file name, so link every file under the
// repo's examples/ tree into one flat folder.
export default function globalSetup() {
  const target = TEST_CONFIG.testFolderPath;
  fs.mkdirSync(target, { recursive: true });

  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      const link = path.join(target, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (!fs.existsSync(link)) fs.symlinkSync(full, link); // first copy of a duplicate name wins
    }
  };
  walk(EXAMPLES_DIR);
}
