import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { McdMcpClient } from '../src/mcp/client.js';
import { assertPublicArguments, assertPublicReadTool } from '../src/mcp/policy.js';

// No token in arguments, logs, tool arguments, fixtures, or Markdown.
const token = process.env.MCD_MCP_TOKEN?.trim();
if (!token) {
  console.error('缺少本地 MCD_MCP_TOKEN。T0 尚未实测，未向麦当劳发送请求。');
  process.exit(2);
}

const client = new McdMcpClient(token);
const captureTime = new Date().toISOString();
try {
  await mkdir('.local/probes', { recursive: true, mode: 0o700 });
  const tools = await client.listTools();
  // tools/list contains public schemas only. Live tool results stay local until reviewed.
  await writeFile('.local/probes/tools-list.json', JSON.stringify({ capturedAt: captureTime, tools }, null, 2) + '\n', { mode: 0o600 });
  console.log(`已读到 ${tools.length} 个工具，schema 保存在 .local/probes/tools-list.json。`);

  const batchPath = process.argv[2];
  if (batchPath) {
    const calls: unknown = JSON.parse(await readFile(batchPath, 'utf8'));
    if (!Array.isArray(calls) || calls.length > 40) throw new Error('INVALID_PROBE_BATCH');
    // Validate the entire batch before making any call.
    for (const call of calls) {
      if (!call || typeof call.name !== 'string' || !call.arguments || typeof call.arguments !== 'object' || Array.isArray(call.arguments)) throw new Error('INVALID_PROBE_CALL');
      assertPublicReadTool(call.name);
      assertPublicArguments(call.arguments);
      if (!tools.some(tool => tool.name === call.name)) throw new Error('UNKNOWN_REMOTE_TOOL');
    }
    for (const [index, call] of calls.entries()) {
      const result = await client.call(call.name, call.arguments);
      const safe = JSON.stringify({ capturedAt: new Date().toISOString(), name: call.name, arguments: call.arguments, result }, null, 2).replaceAll(token, '[REDACTED]');
      await writeFile(`.local/probes/${String(index + 1).padStart(2, '0')}-${call.name}.json`, safe + '\n', { mode: 0o600 });
      console.log(`${index + 1}/${calls.length} ${call.name}：响应已保存本地，尚未发布为夹具。`);
    }
  }
} catch (error) {
  // Limit diagnostics to fixed errors; upstream errors could include request details.
  const message = error instanceof Error ? error.message : '';
  console.error(/^[A-Z_]+$/.test(message) ? message : 'MCD_T0_PROBE_FAILED');
  process.exitCode = 1;
} finally {
  await client.close();
}
