const fs = require('fs');
const http = require('http');
const https = require('https');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { URL } = require('url');

const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || __dirname;
const DEFAULT_DESKTOP_BUILD_FOLDER = path.join(os.homedir(), 'OneDrive', 'Desktop', 'MS.Win32');
const DESKTOP_BUILD_FOLDER = process.argv.slice(2).find(arg => arg.startsWith('--desktopBuild='))?.split('=')[1] || process.env.DESKTOP_BUILD_FOLDER || DEFAULT_DESKTOP_BUILD_FOLDER;
const TEMPLATE_URL = process.argv.slice(2).find(arg => arg.startsWith('--fetchUrl='))?.split('=')[1] || process.env.FETCH_URL;
const KEYWORDS = process.argv.slice(2).find(arg => arg.startsWith('--keywords='))?.split('=')[1]?.split(',').map(k => k.trim()).filter(Boolean) || (process.env.KEYWORDS ? process.env.KEYWORDS.split(',').map(k => k.trim()).filter(Boolean) : []);
const ALLOW_INTERNET = process.argv.includes('--allowInternet') || process.env.ALLOW_INTERNET === 'true';

console.log('Logger Init');
console.log('Workspace root:', WORKSPACE_ROOT);
console.log('Desktop build folder:', DESKTOP_BUILD_FOLDER);
console.log('Allow internet:', ALLOW_INTERNET);
console.log('Active keywords:', KEYWORDS.length > 0 ? KEYWORDS.join(', ') : 'none');

if (TEMPLATE_URL) {
  if (!ALLOW_INTERNET) {
    console.warn('Template URL provided but internet access is disabled. Set --allowInternet or ALLOW_INTERNET=true to enable downloads.');
  } else {
    fetchSource(TEMPLATE_URL, DESKTOP_BUILD_FOLDER);
  }
}

if (!fs.existsSync(DESKTOP_BUILD_FOLDER)) {
  console.warn('Desktop build folder not found:', DESKTOP_BUILD_FOLDER);
  process.exit(0);
}

ensureDotnetProject(DESKTOP_BUILD_FOLDER);
const desktopBuildResults = buildApplicationsInDirectory(DESKTOP_BUILD_FOLDER);
console.log('Desktop build results:', JSON.stringify(desktopBuildResults, null, 2));

const lspEnabled = tryInitializeLsp(WORKSPACE_ROOT);
if (!lspEnabled) {
  console.log('LSP unavailable; skipping code update from LSP.');
}

function tryInitializeLsp(rootPath) {
  let lsp;
  try {
    lsp = require('vscode-languageserver/node');
  } catch (err) {
    console.warn('Optional LSP dependency not installed:', err.message);
    return false;
  }

  const net = require('net');
  const { createConnection, StreamMessageReader, StreamMessageWriter } = lsp;
  const LSP_PORT = process.env.LSP_PORT || 6009;

  const client = net.createConnection({ port: LSP_PORT }, () => {
    console.log('Connected to LSP server on port', LSP_PORT);
  });

  const reader = new StreamMessageReader(client);
  const writer = new StreamMessageWriter(client);
  const connection = createConnection(reader, writer);
  connection.listen();

  connection.sendRequest('initialize', {
    processId: process.pid,
    rootUri: `file://${rootPath}`,
    capabilities: {}
  }).then(() => {
    console.log('LSP initialized.');
    const javaFilePath = path.join(rootPath, 'GWorkspaceReportsAPISentinelConnector', 'src', 'main', 'java', 'com', 'example', 'Connector.java');
    if (fs.existsSync(javaFilePath)) {
      connection.sendNotification('textDocument/didOpen', {
        textDocument: {
          uri: `file://${javaFilePath}`,
          languageId: 'java',
          version: 1,
          text: fs.readFileSync(javaFilePath, 'utf8')
        }
      });

      connection.sendRequest('textDocument/completion', {
        textDocument: { uri: `file://${javaFilePath}` },
        position: { line: 10, character: 0 }
      }).then(completions => {
        const examples = (completions.items || []).filter(item => item.detail && item.detail.includes('API Usage'));
        if (examples.length > 0) {
          const updatedCode = generateUpdatedJavaCode(examples);
          fs.writeFileSync(javaFilePath, updatedCode, 'utf8');
          console.log('Workspace updated with API usage examples.');
        } else {
          console.log('No relevant examples found.');
        }
        client.end();
      }).catch(err => {
        console.error('Error fetching completions:', err);
        client.end();
      });
    } else {
      console.log('Java file not found; skipping update.');
      client.end();
    }
  }).catch(err => {
    console.error('LSP initialization failed:', err);
    client.end();
  });

  return true;
}

function ensureDotnetProject(projectRoot) {
  const csprojPath = path.join(projectRoot, 'MS.Win32.csproj');
  const existingCsProj = findFileByExtension(projectRoot, '.csproj');
  const existingSln = findFileByExtension(projectRoot, '.sln');
  if (existingSln) {
    console.log('Existing .NET solution metadata found in', projectRoot);
    return;
  }

  const csFiles = findCsFiles(projectRoot);
  if (csFiles.length === 0) {
    console.warn('No C# sources found, skipping project file generation.');
    return;
  }

  const invalidFiles = csFiles.filter(file => !isValidCSharpFile(file));
  const validCsFiles = csFiles.filter(isValidCSharpFile);
  if (validCsFiles.length === 0) {
    console.warn('All C# sources are invalid or unsupported; skipping project file generation.');
    console.warn('Invalid files:', invalidFiles.map(f => path.basename(f)).join(', '));
    return;
  }

  if (invalidFiles.length > 0) {
    console.warn('Skipping invalid C# files for project generation:', invalidFiles.map(f => path.basename(f)).join(', '));
  }

  if (existingCsProj && existingCsProj !== csprojPath) {
    console.log('Existing .NET project metadata found in', projectRoot);
    return;
  }

  const outputType = hasMainMethod(validCsFiles) ? 'Exe' : 'Library';
  const metadata = collectProjectMetadata(validCsFiles);
  const projectContent = generateCsProjContent(outputType, projectRoot, validCsFiles, metadata);
  if (!fs.existsSync(csprojPath) || fs.readFileSync(csprojPath, 'utf8') !== projectContent) {
    console.log('Writing .NET project file:', csprojPath);
    fs.writeFileSync(csprojPath, projectContent, 'utf8');
  }
}

function collectProjectMetadata(sourceFiles) {
  const metadata = {
    targetFramework: 'net8.0',
    useWpf: false,
    allowUnsafeBlocks: false,
  };

  for (const file of sourceFiles) {
    const content = fs.readFileSync(file, 'utf8');
    if (!metadata.useWpf && /\b(System\.Windows|DispatcherObject|DispatcherOperationCallback|WindowMessage|MS\.Internal\.WindowsBase)\b/.test(content)) {
      metadata.useWpf = true;
      metadata.targetFramework = 'net8.0-windows';
    }
    if (!metadata.allowUnsafeBlocks && /\bunsafe\b|\*\s*[a-zA-Z_]|fixed\s*\(/.test(content)) {
      metadata.allowUnsafeBlocks = true;
    }
  }

  return metadata;
}

function findCsFiles(folder) {
  const ignoredDirectories = new Set(['obj', 'bin', '.git', '.vs', 'node_modules', 'packages', 'TestResults']);
  const results = [];

  function recurse(current) {
    fs.readdirSync(current, { withFileTypes: true }).forEach(entry => {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (ignoredDirectories.has(entry.name.toLowerCase())) {
          return;
        }
        recurse(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.cs')) {
        results.push(fullPath);
      }
    });
  }

  recurse(folder);
  return results;
}

function findFileByExtension(folder, extension) {
  const entry = fs.readdirSync(folder, { withFileTypes: true })
    .find(file => file.isFile() && file.name.toLowerCase().endsWith(extension));
  return entry ? path.join(folder, entry.name) : null;
}

function isValidCSharpFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('#@')) {
    return false;
  }

  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    if (/^[ \t]+#/.test(line) && !/^#[ \t]*(if|else|elif|endif|pragma|region|endregion|nullable|define|undef|line|error|warning)/.test(line)) {
      return false;
    }
    if (line.includes('#@')) {
      return false;
    }
  }

  const braceBalance = countBraceBalance(content);
  if (braceBalance !== 0) {
    console.warn(`Skipping malformed C# source due to brace imbalance (${braceBalance}): ${path.basename(filePath)}`);
    return false;
  }

  return true;
}

function countBraceBalance(text) {
  let balance = 0;
  let state = 'normal';

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    switch (state) {
      case 'normal':
        if (ch === '/' && next === '/') {
          state = 'lineComment';
          i++;
        } else if (ch === '/' && next === '*') {
          state = 'blockComment';
          i++;
        } else if (ch === '@' && next === '"') {
          state = 'verbatimString';
          i++;
        } else if (ch === '"') {
          state = 'string';
        } else if (ch === "'") {
          state = 'char';
        } else if (ch === '{') {
          balance += 1;
        } else if (ch === '}') {
          balance -= 1;
        }
        break;
      case 'string':
        if (ch === '\\') {
          i++;
        } else if (ch === '"') {
          state = 'normal';
        }
        break;
      case 'verbatimString':
        if (ch === '"') {
          if (next === '"') {
            i++;
          } else {
            state = 'normal';
          }
        }
        break;
      case 'char':
        if (ch === '\\') {
          i++;
        } else if (ch === "'") {
          state = 'normal';
        }
        break;
      case 'lineComment':
        if (ch === '\n') {
          state = 'normal';
        }
        break;
      case 'blockComment':
        if (ch === '*' && next === '/') {
          state = 'normal';
          i++;
        }
        break;
    }
  }

  return balance;
}

function hasMainMethod(files) {
  return files.some(file => {
    const content = fs.readFileSync(file, 'utf8');
    return /static\s+(?:void|int)\s+Main\s*\(/.test(content);
  });
}

function buildApplicationsInDirectory(rootFolder) {
  const results = [];
  const entries = fs.readdirSync(rootFolder, { withFileTypes: true });
  const projectRoots = [];

  if (hasBuildMetadata(rootFolder)) {
    projectRoots.push(rootFolder);
  }

  entries.forEach(entry => {
    if (entry.isDirectory()) {
      const candidate = path.join(rootFolder, entry.name);
      if (hasBuildMetadata(candidate)) {
        projectRoots.push(candidate);
      }
    }
  });

  projectRoots.forEach(projectRoot => {
    const result = buildProject(projectRoot);
    results.push({ projectRoot, ...result });
  });

  return results;
}

function hasBuildMetadata(folder) {
  return !!findFileByExtension(folder, '.csproj') ||
         !!findFileByExtension(folder, '.sln') ||
         fs.existsSync(path.join(folder, 'package.json')) ||
         fs.existsSync(path.join(folder, 'pom.xml')) ||
         fs.existsSync(path.join(folder, 'requirements.txt'));
}

function buildProject(projectRoot) {
  if (!fs.existsSync(projectRoot)) {
    return { success: false, message: 'Project root does not exist.' };
  }

  const csprojFile = findFileByExtension(projectRoot, '.csproj');
  if (csprojFile) {
    if (!runCommand('dotnet', ['build', csprojFile], projectRoot)) {
      return { success: false, message: 'Dotnet build failed.' };
    }
    return { success: true, message: 'Built .NET project.' };
  }

  const slnFile = findFileByExtension(projectRoot, '.sln');
  if (slnFile) {
    if (!runCommand('dotnet', ['build', slnFile], projectRoot)) {
      return { success: false, message: 'Dotnet solution build failed.' };
    }
    return { success: true, message: 'Built .NET solution.' };
  }

  if (fs.existsSync(path.join(projectRoot, 'package.json'))) {
    if (!runCommand('npm', ['install'], projectRoot)) {
      return { success: false, message: 'npm install failed.' };
    }
    if (!runCommand('npm', ['run', 'build'], projectRoot)) {
      return { success: false, message: 'npm run build failed.' };
    }
    return { success: true, message: 'Built npm project.' };
  }

  if (fs.existsSync(path.join(projectRoot, 'pom.xml'))) {
    if (!runCommand('mvn', ['clean', 'package'], projectRoot)) {
      return { success: false, message: 'Maven build failed.' };
    }
    return { success: true, message: 'Built Maven project.' };
  }

  if (fs.existsSync(path.join(projectRoot, 'requirements.txt'))) {
    const pythonFiles = fs.readdirSync(projectRoot).filter(name => name.endsWith('.py'));
    if (pythonFiles.length > 0) {
      if (!runCommand('python', ['-m', 'py_compile', ...pythonFiles], projectRoot)) {
        return { success: false, message: 'Python compile failed.' };
      }
      return { success: true, message: 'Validated Python sources.' };
    }
    return { success: false, message: 'requirements.txt found but no Python files detected.' };
  }

  return { success: false, message: 'No recognized build metadata found.' };
}

function runCommand(command, args, cwd) {
  console.log(`Running command: ${command} ${args.join(' ')} in ${cwd}`);
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', shell: true });
  if (result.error) {
    console.error(`Command failed: ${result.error.message}`);
    return false;
  }
  if (result.status !== 0) {
    console.error(`Command exited with code ${result.status}`);
    return false;
  }
  return true;
}

function fetchSource(sourceUrl, destinationFolder) {
  console.log('Fetching source from URL:', sourceUrl);
  try {
    const url = new URL(sourceUrl);
    const client = url.protocol === 'https:' ? https : http;
    const fileName = path.basename(url.pathname) || 'downloaded_source';
    const destinationPath = path.join(destinationFolder, fileName);

    client.get(url, response => {
      if (response.statusCode !== 200) {
        console.error('Download failed, status code:', response.statusCode);
        return;
      }

      const buffers = [];
      response.on('data', chunk => buffers.push(chunk));
      response.on('end', () => {
        const body = Buffer.concat(buffers).toString('utf8');
        if (KEYWORDS.length > 0) {
          const match = KEYWORDS.some(keyword => body.toLowerCase().includes(keyword.toLowerCase()));
          if (!match) {
            console.warn('Downloaded content did not match any active keywords; skipping save.');
            return;
          }
        }

        fs.writeFileSync(destinationPath, body, 'utf8');
        console.log('Downloaded source to:', destinationPath);
      });
    }).on('error', err => {
      console.error('Download error:', err.message);
    });
  } catch (err) {
    console.error('Invalid URL or network error:', err.message);
  }
}

function generateCsProjContent(outputType, projectRoot, sourceFiles, metadata) {
  const compileItems = sourceFiles
    .map(file => path.relative(projectRoot, file).replace(/\\/g, '\\\\'))
    .map(relativePath => `    <Compile Include="${relativePath}" />`)
    .join('\n');

  const propertyLines = [
    `    <OutputType>${outputType}</OutputType>`,
    `    <TargetFramework>${metadata.targetFramework}</TargetFramework>`,
    '    <ImplicitUsings>enable</ImplicitUsings>',
    '    <Nullable>enable</Nullable>',
    '    <EnableDefaultCompileItems>false</EnableDefaultCompileItems>',
    '    <RootNamespace>MS.Win32</RootNamespace>',
    '    <AssemblyName>MS.Win32</AssemblyName>',
  ];

  if (metadata.useWpf) {
    propertyLines.push('    <UseWPF>true</UseWPF>');
  }
  if (metadata.allowUnsafeBlocks) {
    propertyLines.push('    <AllowUnsafeBlocks>true</AllowUnsafeBlocks>');
  }

  return `<?xml version="1.0" encoding="utf-8"?>
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
${propertyLines.join('\n')}
  </PropertyGroup>
  <ItemGroup>
${compileItems}
  </ItemGroup>
</Project>
`;
}

function generateUpdatedJavaCode(examples) {
  let code = '// Updated Java code with Azure SDK best practices\n';
  code += 'import com.azure.core.credential.TokenCredential;\n';
  code += 'import com.azure.identity.DefaultAzureCredentialBuilder;\n';
  code += '\npublic class Connector {\n';
  code += '    public static void main(String[] args) {\n';
  code += '        try {\n';
  code += '            TokenCredential credential = new DefaultAzureCredentialBuilder().build();\n';
  code += `            // Use example from LSP: ${examples[0].insertText || 'example text'}\n`;
  code += '            System.out.println("Connected to Azure Sentinel.");\n';
  code += '        } catch (Exception e) {\n';
  code += '            System.err.println("Error: " + e.getMessage());\n';
  code += '        }\n';
  code += '    }\n';
  code += '}\n';
  return code;
}
