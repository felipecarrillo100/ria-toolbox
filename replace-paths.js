const fs = require('fs');
const path = require('path');

// Function to adjust import paths in a file
function adjustImportPaths(filePath) {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const adjustedContent = fileContent.replace(/@luciad\/ria-toolbox-(\S+)/g, (match, p1) => {
        // Determine the relative path based on the file's directory level
        const relativePath = path.relative(path.dirname(filePath), path.resolve(__dirname, 'libs', p1));
        return relativePath.replace(/\\/g, '/');  // Convert backslashes to forward slashes for Unix compatibility
    });

    fs.writeFileSync(filePath, adjustedContent, 'utf-8');
}

// Function to recursively process files in a directory
function processDirectory(directory) {
    fs.readdirSync(directory).forEach(file => {
        const fullPath = path.join(directory, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDirectory(fullPath);
        } else if (fullPath.endsWith('.js')) {
            adjustImportPaths(fullPath);
        }
    });
}

// Start processing from the output directory
processDirectory(path.resolve(__dirname, 'libs'));
