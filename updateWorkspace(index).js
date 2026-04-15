const { createConnection, TextDocuments } = require('vscode-languageserver-protocol');
const { StreamMessageReader, StreamMessageWriter } = require('vscode-languageserver-protocol');
const net = require('net');
const fs = require('fs');
const path = require('path');

// Azure best practices: Use environment variables for config
const LSP_PORT = process.env.LSP_PORT || 6009; // Assume standard LSP port
const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || __dirname;

// Logger init (inspired by the log example)
console.log('Logger Init');
console.log('Initialization complete.');

// Connect to LSP server (IntelliCode API Usage Examples)
const client = net.createConnection({ port: LSP_PORT }, () => {
  console.log('Connected to LSP server.');
});

const reader = new StreamMessageReader(client);
const writer = new StreamMessageWriter(client);
const connection = createConnection(reader, writer);

// Initialize LSP connection
connection.listen();

// Send initialize request
connection.sendRequest('initialize', {
  processId: process.pid,
  rootPath: WORKSPACE_ROOT,
  capabilities: {}
}).then(() => {
  console.log('LSP initialized.');
  // Open a sample document (e.g., a Java file in the connector project)
  const javaFilePath = path.join(WORKSPACE_ROOT, 'GWorkspaceReportsAPISentinelConnector', 'src', 'main', 'java', 'com', 'example', 'Connector.java');
  if (fs.existsSync(javaFilePath)) {
    connection.sendNotification('textDocument/didOpen', {
      textDocument: {
        uri: `file://${javaFilePath}`,
        languageId: 'java',
        version: 1,
        text: fs.readFileSync(javaFilePath, 'utf8')
      }
    });

    // Request completion at a position (e.g., where Azure SDK is used)
    connection.sendRequest('textDocument/completion', {
      textDocument: { uri: `file://${javaFilePath}` },
      position: { line: 10, character: 0 } // Assume a position with Azure API
    }).then(completions => {
      // Parse completions for usage examples (simplified; real parsing would filter for IntelliCode examples)
      const examples = completions.items.filter(item => item.detail && item.detail.includes('API Usage'));
      if (examples.length > 0) {
        const updatedCode = generateUpdatedJavaCode(examples);
        fs.writeFileSync(javaFilePath, updatedCode);
        console.log('Workspace updated with API usage examples.');
      } else {
        console.log('No relevant examples found.');
      }
      client.end();
    }).catch(err => {
      console.error('Error fetching completions:', err); // Robust error handling per best practices
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

// Function to generate updated Java code using examples (Azure best practices: modular, async-friendly)
function generateUpdatedJavaCode(examples) {
  // Simplified: Adapt examples to Java (e.g., for Azure SDK)
  let code = '// Updated Java code with Azure SDK best practices\n';
  code += 'import com.azure.core.credential.TokenCredential;\n'; // Example import
  code += 'import com.azure.identity.DefaultAzureCredentialBuilder;\n';
  code += '\npublic class Connector {\n';
  code += '    public static void main(String[] args) {\n';
  code += '        // Async pattern per best practices\n';
  code += '        try {\n';
  code += '            TokenCredential credential = new DefaultAzureCredentialBuilder().build();\n';
  code += '            // Use example from LSP: ' + examples[0].insertText + '\n';
  code += '            System.out.println("Connected to Azure Sentinel.");\n';
  code += '        } catch (Exception e) {\n';
  code += '            System.err.println("Error: " + e.getMessage()); // Error handling\n';
  code += '        }\n';
  code += '    }\n';
  code += '}\n';
  return code;
}