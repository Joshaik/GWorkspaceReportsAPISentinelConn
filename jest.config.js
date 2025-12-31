module.exports = {
  collectCoverage: true,
  coverageDirectory: 'coverage/js',
  collectCoverageFrom: ['GWorkspaceReportsAPISentinelConnector/**/*.js'],
  coverageReporters: ['json', 'lcov', 'text', 'clover'],
  reporters: [
    'default',
    ['jest-junit', { outputDirectory: 'test-results', outputName: 'js-test-results.xml' }]
  ],
  testEnvironment: 'jsdom'
};
