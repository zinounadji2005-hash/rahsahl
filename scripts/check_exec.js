const http = require('http');

function callTool(name, args) {
  return new Promise((resolve) => {
    const data = JSON.stringify({ jsonrpc: '2.0', method: 'tools/call', params: { name, arguments: args || {} }, id: 1 });
    const options = {
      hostname: '34.228.227.112',
      port: 80,
      path: '/mcp-server/http',
      method: 'POST',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5Zjc3ZjU2Ny1jMTM4LTQyYjktYTZlYy1lOTYxZmY3YTE4YjIiLCJpc3MiOiJuOG4iLCJhdWQiOiJtY3Atc2VydmVyLWFwaSIsImp0aSI6ImRhZjE0N2VhLTA2MGEtNDk2NS04MzU5LWU3N2Y0YjlkYzdjYSIsImlhdCI6MTc4MDU2NDExMH0.1IZqkfyzrWzGFzkFLlb7QbbFBnz1WOWxTz7FBVha-Ew',
        'Content-Length': Buffer.byteLength(data)
      }
    };
    const req = http.request(options, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        const lines = d.split('\n').filter(l => l.startsWith('data: '));
        if (lines.length > 0) {
          try { resolve(JSON.parse(lines[0].replace('data: ', ''))); }
          catch(e) { resolve({ raw: d.substring(0, 8000) }); }
        } else resolve({ raw: d });
      });
    });
    req.on('error', (e) => resolve({ error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ error: 'Timeout' }); });
    req.write(data);
    req.end();
  });
}

(async () => {
  const searchRes = await callTool('search_executions', { workflowId: 'Ho9ckqmOgXl3665g', limit: 1 });
  const searchData = JSON.parse(searchRes.result.content[0].text);
  const execId = searchData.data[0].id;
  console.log('Execution ID:', execId);

  const res = await callTool('get_execution', { executionId: execId, workflowId: 'Ho9ckqmOgXl3665g' });
  const text = res.result.content[0].text;
  try {
    const json = JSON.parse(text);
    console.log('Status:', json.status);
    console.log('Error:', json.error || 'none');
    if (json.data && json.data.resultData) {
      console.log('Last node:', json.data.resultData.lastNodeExecuted);
      console.log('Error node:', json.data.resultData.error?.node?.name);
      console.log('Error msg:', json.data.resultData.error?.message);
    }
    console.log('\n--- Run data ---');
    if (json.data && json.data.resultData && json.data.resultData.runData) {
      Object.keys(json.data.resultData.runData).forEach(node => {
        const runs = json.data.resultData.runData[node];
        runs.forEach(run => {
          if (run.error) {
            console.log(`\n[${node}] ERROR:`, JSON.stringify(run.error));
          } else {
            console.log(`[${node}] OK - ${run.data?.main?.[0]?.[0]?.json ? 'has output' : 'no output'}`);
          }
        });
      });
    }
  } catch (e) {
    console.log(text.substring(0, 5000));
  }
})();
