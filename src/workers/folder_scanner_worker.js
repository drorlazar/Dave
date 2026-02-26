// folder_scanner_worker.js

// Inline file type detection (workers can't use ES modules)
const FILE_TYPE_MAPPINGS = {
  // 3D Model formats
  '.glb': { type: '3d', subtype: 'glb' },
  '.gltf': { type: '3d', subtype: 'gltf' },
  '.fbx': { type: '3d', subtype: 'fbx' },
  '.obj': { type: '3d', subtype: 'obj' },
  '.dae': { type: '3d', subtype: 'dae' },
  '.stl': { type: '3d', subtype: 'stl' },
  '.ply': { type: '3d', subtype: 'ply' },
  '.3ds': { type: '3d', subtype: '3ds' },

  // Video formats
  '.mp4': { type: 'video', subtype: 'mp4' },
  '.webm': { type: 'video', subtype: 'webm' },
  '.ogv': { type: 'video', subtype: 'ogg' },
  '.mov': { type: 'video', subtype: 'mov' },
  '.avi': { type: 'video', subtype: 'avi' },
  '.mkv': { type: 'video', subtype: 'mkv' },

  // Audio formats
  '.mp3': { type: 'audio', subtype: 'mp3' },
  '.wav': { type: 'audio', subtype: 'wav' },
  '.ogg': { type: 'audio', subtype: 'ogg' },
  '.oga': { type: 'audio', subtype: 'ogg' },
  '.flac': { type: 'audio', subtype: 'flac' },
  '.m4a': { type: 'audio', subtype: 'm4a' },

  // Image formats
  '.jpg': { type: 'image', subtype: 'jpg' },
  '.jpeg': { type: 'image', subtype: 'jpg' },
  '.png': { type: 'image', subtype: 'png' },
  '.gif': { type: 'image', subtype: 'gif' },
  '.webp': { type: 'image', subtype: 'webp' },
  '.svg': { type: 'image', subtype: 'svg' },
  '.bmp': { type: 'image', subtype: 'bmp' },
  '.tiff': { type: 'image', subtype: 'tiff' },
  '.tif': { type: 'image', subtype: 'tiff' },
  '.ico': { type: 'image', subtype: 'ico' },

  // Font formats
  '.ttf': { type: 'font', subtype: 'ttf' },
  '.otf': { type: 'font', subtype: 'otf' },
  '.woff': { type: 'font', subtype: 'woff' },
  '.woff2': { type: 'font', subtype: 'woff2' },

  // Document formats
  '.pdf': { type: 'document', subtype: 'pdf' },

  // Text formats
  '.txt': { type: 'text', subtype: 'txt' },
  '.text': { type: 'text', subtype: 'txt' },
  '.md': { type: 'text', subtype: 'md' },
  '.markdown': { type: 'text', subtype: 'md' },
  '.json': { type: 'text', subtype: 'json' },
  '.xml': { type: 'text', subtype: 'xml' },
  '.csv': { type: 'text', subtype: 'csv' },
  '.yaml': { type: 'text', subtype: 'yaml' },
  '.yml': { type: 'text', subtype: 'yaml' },
  '.log': { type: 'text', subtype: 'log' },
  '.ini': { type: 'text', subtype: 'ini' },
  '.cfg': { type: 'text', subtype: 'cfg' },
  '.conf': { type: 'text', subtype: 'conf' },
  '.toml': { type: 'text', subtype: 'toml' },

  // Code files
  '.py': { type: 'text', subtype: 'py' },
  '.js': { type: 'text', subtype: 'js' },
  '.mjs': { type: 'text', subtype: 'js' },
  '.cjs': { type: 'text', subtype: 'js' },
  '.ts': { type: 'text', subtype: 'ts' },
  '.tsx': { type: 'text', subtype: 'ts' },
  '.jsx': { type: 'text', subtype: 'jsx' },
  '.html': { type: 'text', subtype: 'html' },
  '.htm': { type: 'text', subtype: 'html' },
  '.css': { type: 'text', subtype: 'css' },
  '.sh': { type: 'text', subtype: 'sh' },
  '.bash': { type: 'text', subtype: 'sh' },
  '.zsh': { type: 'text', subtype: 'sh' },
  '.bat': { type: 'text', subtype: 'bat' },
  '.cmd': { type: 'text', subtype: 'bat' },
  '.rb': { type: 'text', subtype: 'rb' },
  '.php': { type: 'text', subtype: 'php' },
  '.java': { type: 'text', subtype: 'java' },
  '.go': { type: 'text', subtype: 'go' },
  '.rs': { type: 'text', subtype: 'rs' },
  '.swift': { type: 'text', subtype: 'swift' },
  '.kt': { type: 'text', subtype: 'kt' },
  '.kts': { type: 'text', subtype: 'kt' },
  '.c': { type: 'text', subtype: 'c' },
  '.h': { type: 'text', subtype: 'c' },
  '.cpp': { type: 'text', subtype: 'cpp' },
  '.hpp': { type: 'text', subtype: 'cpp' },
  '.cc': { type: 'text', subtype: 'cpp' },
  '.cxx': { type: 'text', subtype: 'cpp' },
  '.cs': { type: 'text', subtype: 'cs' },
  '.sql': { type: 'text', subtype: 'sql' },
  '.r': { type: 'text', subtype: 'r' },
  '.lua': { type: 'text', subtype: 'lua' },
  '.dart': { type: 'text', subtype: 'dart' },
  '.scala': { type: 'text', subtype: 'scala' },

  // Config/env files
  '.env': { type: 'text', subtype: 'env' },
  '.example': { type: 'text', subtype: 'example' },
  '.local': { type: 'text', subtype: 'local' },
  '.properties': { type: 'text', subtype: 'properties' },
  '.dockerfile': { type: 'text', subtype: 'dockerfile' },

  // Style preprocessors & data
  '.scss': { type: 'text', subtype: 'scss' },
  '.sass': { type: 'text', subtype: 'scss' },
  '.less': { type: 'text', subtype: 'scss' },
  '.graphql': { type: 'text', subtype: 'graphql' },
  '.gql': { type: 'text', subtype: 'graphql' },
  '.proto': { type: 'text', subtype: 'proto' }
};

function detectFileType(filename) {
  if (!filename) return null;

  const lowerFilename = filename.toLowerCase();
  const lastDotIndex = lowerFilename.lastIndexOf('.');

  if (lastDotIndex === -1) return null;

  const extension = lowerFilename.slice(lastDotIndex);
  return FILE_TYPE_MAPPINGS[extension] || null;
}

async function scanDirectory(dirHandle, currentRecursiveDepth, maxDepth, pathPrefix) {
  try {
    let fileCountInDir = 0;
    for await (const [name, handle] of dirHandle.entries()) {
      if (handle.kind === 'file') {
        try {
          const file = await handle.getFile();
          const typeInfo = detectFileType(file.name);

          // Get extension for unknown file types
          let finalType, finalSubtype;
          if (typeInfo) {
            finalType = typeInfo.type;
            finalSubtype = typeInfo.subtype;
          } else {
            const lastDot = file.name.lastIndexOf('.');
            if (lastDot === -1) continue; // Skip files with no extension
            finalType = 'other';
            finalSubtype = file.name.slice(lastDot + 1).toLowerCase();
          }

          self.postMessage({
            status: 'fileFound',
            fileEntry: {
              name: file.name,
              file: file,
              type: finalType,
              subtype: finalSubtype,
              fullPath: pathPrefix + file.name
            }
          });
          fileCountInDir++;
        } catch (fileError) {
          console.error(`Worker: Error getting file handle for ${name} in ${pathPrefix}:`, fileError);
          self.postMessage({ status: 'scanError', error: `Error processing file ${pathPrefix}${name}: ${fileError.message}` });
        }
      } else if (handle.kind === 'directory') {
        if (currentRecursiveDepth < maxDepth) {
          await scanDirectory(handle, currentRecursiveDepth + 1, maxDepth, pathPrefix + name + '/');
        }
      }
    }
    // Optional: progress for each directory processed
    // self.postMessage({ status: 'scanProgress', message: `Finished scanning ${pathPrefix}`, count: fileCountInDir });
  } catch (dirError) {
    console.error(`Worker: Error scanning directory ${pathPrefix}:`, dirError);
    self.postMessage({ status: 'scanError', error: `Error scanning directory ${pathPrefix}: ${dirError.message}` });
    // Decide if we should re-throw or if scanComplete will still be called.
    // For now, let scanComplete be called by the top-level invoker.
    throw dirError; // Re-throw to be caught by the top-level try-catch in onmessage
  }
}

self.onmessage = async (event) => {
  const { dirHandle, maxDepth: inputMaxDepth, currentPath } = event.data;

  if (!dirHandle) {
    self.postMessage({ status: 'scanError', error: 'Directory handle not provided.' });
    return;
  }
  console.log(`Worker: Received scan request for "${currentPath}" with maxDepth: ${inputMaxDepth}`);

  // Determine actual maxDepth for recursion (0 for 'off', Infinity for 'all')
  let maxRecursiveDepth = 0;
  if (inputMaxDepth === 'all') {
    maxRecursiveDepth = Infinity;
  } else if (inputMaxDepth !== 'off') {
    maxRecursiveDepth = parseInt(inputMaxDepth, 10);
    if (isNaN(maxRecursiveDepth)) maxRecursiveDepth = 0; // Default to 0 if parsing fails
  }
  // Note: The worker's maxDepth is for *recursion*. 'off' means maxRecursiveDepth = 0.
  // The first level (currentRecursiveDepth = 0) will always be scanned.

  try {
    await scanDirectory(dirHandle, 0, maxRecursiveDepth, currentPath); // Start with depth 0
    self.postMessage({ status: 'scanComplete' });
  } catch (e) {
    // This catches errors re-thrown from scanDirectory's top level.
    console.error(`Worker: Overall scan failed for ${currentPath}:`, e);
    // Notify the main thread that the scan failed so the UI can respond
    self.postMessage({ status: 'scanFailed', error: `Scan failed for ${currentPath}: ${e.message}` });
  }
};

console.log('Worker: folder_scanner_worker.js loaded and ready.');
