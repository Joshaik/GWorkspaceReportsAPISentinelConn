const nock = require('nock');
const path = require('path');

const joshaik = require(path.resolve(__dirname, '../../GWorkspaceReportsAPISentinelConnector/joshaik.js'));

describe('joshaik.js basic tests', () => {
  test('udpEchoDemo returns timeout when no echo server', async () => {
    const res = await joshaik.udpEchoDemo('127.0.0.1', 42101, 200);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('timeout');
  });
});
